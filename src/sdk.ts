import {
  type Domain,
  type DomainStorageValue,
  KeyValueDbContract,
  type Record,
  RecordKey,
  RecordType,
  RegistryContract,
  ReverseRegistrarContract,
  SIMULATION_ACCOUNT,
  type SorobanDomainsSDKParams,
  type SubDomain,
} from "./types.ts";
import { crypto } from "@std/crypto";
import { encodeHex } from "@std/encoding";
import { concat } from "@std/bytes";
import { Domain404Error, DomainData404Error, DomainDataUnsupportedValueType, ReverseDomain404Error } from "./errors.ts";
import {
  Account,
  Contract,
  nativeToScVal,
  Networks,
  rpc,
  scValToNative,
  type Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { decodeHex } from "@std/encoding/hex";

export class SorobanDomainsSDK {
  readonly #rpcUrl?: string;
  readonly #simulationAccount: string;
  readonly #globalFee: string;
  readonly #registerContract: string;
  readonly #keyValueDbContract: string;
  readonly #reverseRegistrarContract: string;
  readonly #network: Networks;
  readonly #defaultTimeout: number;

  get server(): rpc.Server {
    if (!this.#rpcUrl) {
      throw new Error("This method requires that you define an `rpcUrl` value.");
    }

    return new rpc.Server(this.#rpcUrl);
  }

  constructor(params: SorobanDomainsSDKParams) {
    this.#rpcUrl = params.rpcUrl;
    this.#simulationAccount = params.simulationAccount || SIMULATION_ACCOUNT;
    this.#globalFee = params.defaultFee || "100";
    this.#registerContract = params.registryContractId || RegistryContract.v0;
    this.#keyValueDbContract = params.keyValuesDatabaseContractId || KeyValueDbContract.v0;
    this.#reverseRegistrarContract = params.reverseRegistrarContractId || ReverseRegistrarContract.v0;
    this.#network = params.network || Networks.PUBLIC;
    this.#defaultTimeout = params.defaultTimeout || 0;
  }

  static hash(text: string | Uint8Array): Uint8Array {
    return new Uint8Array(
      crypto.subtle.digestSync("KECCAK-256", typeof text === "string" ? new TextEncoder().encode(text) : text),
    );
  }

  /**
   * This function takes a domain and generates the "node" value of the parsed domain.
   * This "node" value can be used to fetch data from the contract (either if is a Record or a SubRecord)
   */
  static parseDomain(params: { domain: string; subDomain?: string; tld?: string }): string {
    const node: Uint8Array = this.hash(concat([
      this.hash(params.tld || "xlm"),
      this.hash(params.domain),
    ]));

    if (params.subDomain) {
      const subNode: Uint8Array = this.hash(concat([
        this.hash(node),
        this.hash(params.subDomain),
      ]));
      return encodeHex(subNode);
    } else {
      return encodeHex(node);
    }
  }

  /**
   * This method validates a domain string follow certain criteria required by the registry contract.
   * NOTE: It does not validate wrong TLDs
   *
   * @param domain {String} - The domain to validate, for example: stellar.xlm
   */
  static isValidDomain(domain: string): boolean {
    const domainRegex: RegExp = new RegExp("^[a-z]+(\\.[a-z]+)*\\.[a-z]{2,}$");
    if (!domainRegex.test(domain)) return false;
    const parts: string[] = domain.split(".");
    if (parts.length > 3) return false;
    return parts.every((part: string): boolean => part.length <= 15);
  }

  /**
   * This function parses the domain you want to use, and it will search it in the contract.
   * This function doesn't validate the domain you're providing is a valid one.
   */
  async searchDomain(params: { domain: string; subDomain?: string }): Promise<Record> {
    const domainNode: string = SorobanDomainsSDK.parseDomain({
      domain: params.domain.toLocaleLowerCase(),
      subDomain: params.subDomain?.toLocaleLowerCase(),
    });

    const contract: Contract = new Contract(this.#registerContract);
    const nodeBytes: xdr.ScVal = xdr.ScVal.scvBytes(decodeHex(domainNode));

    const record_key: xdr.ScVal = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol(params.subDomain ? RecordKey.SubRecord : RecordKey.Record),
      nodeBytes,
    ]);

    const transaction: Transaction = new TransactionBuilder(new Account(this.#simulationAccount, "0"), {
      networkPassphrase: this.#network,
      fee: this.#globalFee,
    })
      .setTimeout(this.#defaultTimeout)
      .addOperation(contract.call("record", record_key))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.server.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    const result = scValToNative(sim.result!.retval);

    if (!result) {
      throw new Domain404Error();
    }

    if (result[0] === "Domain") {
      return {
        type: RecordType.Domain,
        value: {
          node: result[1].node.toString("hex"),
          owner: result[1].owner.toString("hex"),
          address: result[1].address,
          exp_date: result[1].exp_date.toString(),
          snapshot: result[1].snapshot.toString(),
          collateral: result[1].collateral.toString(),
        } satisfies Domain,
      };
    } else {
      return {
        type: RecordType.SubDomain,
        value: {
          node: result[1].node.toString("hex"),
          parent: result[1].parent.toString("hex"),
          address: result[1].address,
          snapshot: result[1].snapshot.toString(),
        } satisfies SubDomain,
      };
    }
  }

  async getDomainData(params: { node: string; key: string }): Promise<DomainStorageValue> {
    const contract: Contract = new Contract(this.#keyValueDbContract);
    const nodeBytes: xdr.ScVal = xdr.ScVal.scvBytes(decodeHex(params.node));
    const keySymbol: xdr.ScVal = xdr.ScVal.scvSymbol(params.key);

    const transaction: Transaction = new TransactionBuilder(new Account(this.#simulationAccount, "0"), {
      networkPassphrase: this.#network,
      fee: this.#globalFee,
    })
      .setTimeout(this.#defaultTimeout)
      .addOperation(contract.call("get", nodeBytes, keySymbol))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.server.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    const result = scValToNative(sim.result!.retval);

    if (!result) {
      throw new DomainData404Error();
    }

    return result;
  }

  async setDomainData(params: { node: string; key: string; value: DomainStorageValue; source: string }): Promise<{
    tx: Transaction;
    sim: rpc.Api.SimulateTransactionRestoreResponse | rpc.Api.SimulateTransactionSuccessResponse;
  }> {
    const contract: Contract = new Contract(this.#keyValueDbContract);
    const nodeBytes: xdr.ScVal = xdr.ScVal.scvBytes(decodeHex(params.node));
    const keySymbol: xdr.ScVal = xdr.ScVal.scvSymbol(params.key);
    let value: xdr.ScVal;

    switch (params.value[0]) {
      case "Bytes":
        value = xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol("Bytes"),
          xdr.ScVal.scvBytes(params.value[1]),
        ]);
        break;

      case "Number":
        value = xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol("Number"),
          nativeToScVal(params.value[1], { type: "i128" }),
        ]);
        break;

      case "String":
        value = xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol("String"),
          xdr.ScVal.scvString(params.value[1]),
        ]);
        break;

      default:
        throw new DomainDataUnsupportedValueType();
    }

    const account: Account = await this.server.getAccount(params.source);

    const transaction: Transaction = new TransactionBuilder(account, {
      networkPassphrase: this.#network,
      fee: this.#globalFee,
    })
      .setTimeout(this.#defaultTimeout)
      .addOperation(contract.call("set", nodeBytes, keySymbol, value))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.server.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    return {
      tx: rpc.assembleTransaction(transaction, sim).build(),
      sim,
    };
  }

  async removeDomainData(params: { node: string; key: string; source: string }): Promise<{
    tx: Transaction;
    sim: rpc.Api.SimulateTransactionRestoreResponse | rpc.Api.SimulateTransactionSuccessResponse;
  }> {
    const contract: Contract = new Contract(this.#keyValueDbContract);
    const nodeBytes: xdr.ScVal = xdr.ScVal.scvBytes(decodeHex(params.node));
    const keySymbol: xdr.ScVal = xdr.ScVal.scvSymbol(params.key);

    const account: Account = await this.server.getAccount(params.source);

    const transaction: Transaction = new TransactionBuilder(account, {
      networkPassphrase: this.#network,
      fee: this.#globalFee,
    })
      .setTimeout(this.#defaultTimeout)
      .addOperation(contract.call("remove", nodeBytes, keySymbol))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.server.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    return {
      tx: rpc.assembleTransaction(transaction, sim).build(),
      sim,
    };
  }

  /**
   * Sets or clears the reverse domain record for a Stellar address.
   *
   * @param params - The parameters for setting the reverse domain
   * @param params.address - The Stellar address to set the reverse domain for
   * @param params.domain - The domain name to set (e.g. "example.xlm"), or null to clear
   * @param params.source - The source account address that will sign the transaction
   *
   * @returns Promise containing:
   *   - tx: The built transaction
   *   - sim: The simulation response from the Soroban RPC
   *
   * @throws Error if:
   *   - Reverse Registrar contract ID is not configured
   *   - Domain format is invalid (must have at least 2 parts)
   *   - Simulation fails
   */
  async setReverseDomain(params: { address: string; domain: string | null; source: string }): Promise<{
    tx: Transaction;
    sim: rpc.Api.SimulateTransactionRestoreResponse | rpc.Api.SimulateTransactionSuccessResponse;
  }> {
    const addressScval = nativeToScVal(params.address, { type: "address" });

    let domainScval = xdr.ScVal.scvVoid();
    if (params.domain !== null) {
      const parts = params.domain.toLocaleLowerCase().split(".");
      if (parts.length < 2) {
        throw new Error("Invalid domain format");
      }
      const domainParts = {
        tld: new TextEncoder().encode(parts[parts.length - 1]),
        sld: new TextEncoder().encode(parts[parts.length - 2]),
        subs: parts.slice(0, parts.length - 2).map((part) => new TextEncoder().encode(part)),
      };
      domainScval = nativeToScVal(domainParts, {
        type: {
          tld: ["symbol"],
          sld: ["symbol"],
          subs: ["symbol"],
        },
      });
    }

    const contract: Contract = new Contract(this.#reverseRegistrarContract);
    const account: Account = await this.server.getAccount(params.source);
    const transaction: Transaction = new TransactionBuilder(account, {
      networkPassphrase: this.#network,
      fee: this.#globalFee,
    })
      .setTimeout(this.#defaultTimeout)
      .addOperation(contract.call("set", addressScval, domainScval))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.server.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    return {
      tx: rpc.assembleTransaction(transaction, sim).build(),
      sim,
    };
  }

  /**
   * Retrieves the reverse domain record for a Stellar address.
   *
   * @param address - The Stellar address to look up the reverse domain for
   *
   * @returns Promise<string> - The full domain name (e.g. "example.xlm")
   *
   * @throws Error if:
   *   - Reverse Registrar contract ID is not configured
   *   - Simulation fails
   * @throws ReverseDomain404Error if no reverse domain is set for the address
   */
  async getReverseDomain(address: string): Promise<string> {
    const contract: Contract = new Contract(this.#reverseRegistrarContract);
    const addressScval: xdr.ScVal = nativeToScVal(address, { type: "address" });

    const transaction: Transaction = new TransactionBuilder(new Account(this.#simulationAccount, "0"), {
      networkPassphrase: this.#network,
      fee: this.#globalFee,
    })
      .setTimeout(this.#defaultTimeout)
      .addOperation(contract.call("get", addressScval))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.server.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    const result = scValToNative(sim.result!.retval);

    if (!result) {
      throw new ReverseDomain404Error();
    }

    const tld: string = result.tld.toString();
    const sld: string = result.sld.toString();
    const subs: string = result.subs.map((buf: ArrayBuffer) => buf.toString()).join(".");
    return `${subs ? subs + "." : ""}${sld}.${tld}`;
  }
}
