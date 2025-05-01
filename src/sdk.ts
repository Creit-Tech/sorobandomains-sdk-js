import {
  type Domain,
  type DomainStorageValue,
  type Record,
  RecordKey,
  RecordType,
  type SorobanDomainsSDKParams,
  type SubDomain,
} from "./types.ts";
import { crypto } from "@std/crypto";
import { encodeHex } from "@std/encoding";
import { concat } from "@std/bytes";
import { Domain404Error, DomainData404Error, DomainDataUnsupportedValueType, ReverseDomain404Error } from "./errors.ts";
import type { Account, Contract, rpc, Transaction, xdr } from "@stellar/stellar-sdk";
import { decodeHex } from "@std/encoding/hex";

export class SorobanDomainsSDK {
  constructor(public global: SorobanDomainsSDKParams) {}

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
    const domainRegex: RegExp = new RegExp('^[a-z]+(\\.[a-z]+)*\\.[a-z]{2,}$');
    if (!domainRegex.test(domain)) return false;
    const parts: string[] = domain.split('.');
    if (parts.length > 3) return false;
    return parts.every((part: string): boolean => part.length <= 15);
  }

  /**
   * This function parses the domain you want to use, and it will search it in the contract.
   * This function doesn't validate the domain you're providing is a valid one.
   */
  async searchDomain(params: { domain: string; subDomain?: string }): Promise<Record> {
    if (!this.global.vaultsContractId) {
      throw new Error(`Vault's contract id was not provided`);
    }

    const domainNode: string = SorobanDomainsSDK.parseDomain({
      domain: params.domain.toLocaleLowerCase(),
      subDomain: params.subDomain?.toLocaleLowerCase(),
    });

    const contract: Contract = new this.global.stellarSDK.Contract(this.global.vaultsContractId);
    const nodeBytes: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvBytes(decodeHex(domainNode));

    const record_key: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvVec([
      this.global.stellarSDK.xdr.ScVal.scvSymbol(params.subDomain ? RecordKey.SubRecord : RecordKey.Record),
      nodeBytes,
    ]);

    const account: Account = await this.global.rpc.getAccount(this.global.simulationAccount);

    const transaction: Transaction = new this.global.stellarSDK.TransactionBuilder(account, {
      networkPassphrase: this.global.network,
      fee: this.global.defaultFee,
    })
      .setTimeout(this.global.defaultTimeout || 0)
      .addOperation(contract.call("record", record_key))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.global.rpc.simulateTransaction(transaction);

    if (this.global.stellarSDK.rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    const result = this.global.stellarSDK.scValToNative(sim.result!.retval);

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
    if (!this.global.valuesDatabaseContractId) {
      throw new Error(`KeyValue Database contract id was not provided`);
    }

    const contract: Contract = new this.global.stellarSDK.Contract(this.global.valuesDatabaseContractId);
    const nodeBytes: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvBytes(decodeHex(params.node));
    const keySymbol: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvSymbol(params.key);

    const account: Account = await this.global.rpc.getAccount(this.global.simulationAccount);

    const transaction: Transaction = new this.global.stellarSDK.TransactionBuilder(account, {
      networkPassphrase: this.global.network,
      fee: this.global.defaultFee,
    })
      .setTimeout(this.global.defaultTimeout || 0)
      .addOperation(contract.call("get", nodeBytes, keySymbol))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.global.rpc.simulateTransaction(transaction);

    if (this.global.stellarSDK.rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    const result = this.global.stellarSDK.scValToNative(sim.result!.retval);

    if (!result) {
      throw new DomainData404Error();
    }

    return result;
  }

  async setDomainData(params: { node: string; key: string; value: DomainStorageValue; source: string }): Promise<{
    tx: Transaction;
    sim: rpc.Api.SimulateTransactionRestoreResponse | rpc.Api.SimulateTransactionSuccessResponse;
  }> {
    if (!this.global.valuesDatabaseContractId) {
      throw new Error(`KeyValue Database contract id was not provided`);
    }

    const contract: Contract = new this.global.stellarSDK.Contract(this.global.valuesDatabaseContractId);
    const nodeBytes: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvBytes(decodeHex(params.node));
    const keySymbol: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvSymbol(params.key);
    let value: xdr.ScVal;

    switch (params.value[0]) {
      case "Bytes":
        value = this.global.stellarSDK.xdr.ScVal.scvVec([
          this.global.stellarSDK.xdr.ScVal.scvSymbol("Bytes"),
          this.global.stellarSDK.xdr.ScVal.scvBytes(params.value[1]),
        ]);
        break;

      case "Number":
        value = this.global.stellarSDK.xdr.ScVal.scvVec([
          this.global.stellarSDK.xdr.ScVal.scvSymbol("Number"),
          this.global.stellarSDK.nativeToScVal(params.value[1], { type: "i128" }),
        ]);
        break;

      case "String":
        value = this.global.stellarSDK.xdr.ScVal.scvVec([
          this.global.stellarSDK.xdr.ScVal.scvSymbol("String"),
          this.global.stellarSDK.xdr.ScVal.scvString(params.value[1]),
        ]);
        break;

      default:
        throw new DomainDataUnsupportedValueType();
    }

    const account: Account = await this.global.rpc.getAccount(params.source);

    const transaction: Transaction = new this.global.stellarSDK.TransactionBuilder(account, {
      networkPassphrase: this.global.network,
      fee: this.global.defaultFee,
    })
      .setTimeout(this.global.defaultTimeout || 0)
      .addOperation(contract.call("set", nodeBytes, keySymbol, value))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.global.rpc.simulateTransaction(transaction);

    if (this.global.stellarSDK.rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    return {
      tx: this.global.stellarSDK.rpc.assembleTransaction(transaction, sim).build(),
      sim,
    };
  }

  async removeDomainData(params: { node: string; key: string; source: string }): Promise<{
    tx: Transaction;
    sim: rpc.Api.SimulateTransactionRestoreResponse | rpc.Api.SimulateTransactionSuccessResponse;
  }> {
    if (!this.global.valuesDatabaseContractId) {
      throw new Error(`KeyValue Database contract id was not provided`);
    }

    const contract: Contract = new this.global.stellarSDK.Contract(this.global.valuesDatabaseContractId);
    const nodeBytes: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvBytes(decodeHex(params.node));
    const keySymbol: xdr.ScVal = this.global.stellarSDK.xdr.ScVal.scvSymbol(params.key);

    const account: Account = await this.global.rpc.getAccount(params.source);

    const transaction: Transaction = new this.global.stellarSDK.TransactionBuilder(account, {
      networkPassphrase: this.global.network,
      fee: this.global.defaultFee,
    })
      .setTimeout(this.global.defaultTimeout || 0)
      .addOperation(contract.call("remove", nodeBytes, keySymbol))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.global.rpc.simulateTransaction(transaction);

    if (this.global.stellarSDK.rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    return {
      tx: this.global.stellarSDK.rpc.assembleTransaction(transaction, sim).build(),
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
    if (!this.global.reverseRegistrarContractId) {
      throw new Error(`Reverse Registrar contract id was not provided`);
    }

    const addressScval = this.global.stellarSDK.nativeToScVal(params.address, { type: "address" });

    let domainScval = this.global.stellarSDK.xdr.ScVal.scvVoid();
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
      domainScval = this.global.stellarSDK.nativeToScVal(domainParts, {
        type: {
          tld: ["symbol"],
          sld: ["symbol"],
          subs: ["symbol"],
        },
      });
    }

    const contract: Contract = new this.global.stellarSDK.Contract(this.global.reverseRegistrarContractId);
    const account: Account = await this.global.rpc.getAccount(params.source);
    const transaction: Transaction = new this.global.stellarSDK.TransactionBuilder(account, {
      networkPassphrase: this.global.network,
      fee: this.global.defaultFee,
    })
      .setTimeout(this.global.defaultTimeout || 0)
      .addOperation(contract.call("set", addressScval, domainScval))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.global.rpc.simulateTransaction(transaction);

    if (this.global.stellarSDK.rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    return {
      tx: this.global.stellarSDK.rpc.assembleTransaction(transaction, sim).build(),
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
    if (!this.global.reverseRegistrarContractId) {
      throw new Error(`Reverse Registrar contract id was not provided`);
    }

    const contract: Contract = new this.global.stellarSDK.Contract(this.global.reverseRegistrarContractId);
    const addressScval: xdr.ScVal = this.global.stellarSDK.nativeToScVal(address, { type: "address" });

    const account: Account = await this.global.rpc.getAccount(this.global.simulationAccount);
    const transaction: Transaction = new this.global.stellarSDK.TransactionBuilder(account, {
      networkPassphrase: this.global.network,
      fee: this.global.defaultFee,
    })
      .setTimeout(this.global.defaultTimeout || 0)
      .addOperation(contract.call("get", addressScval))
      .build();

    const sim: rpc.Api.SimulateTransactionResponse = await this.global.rpc.simulateTransaction(transaction);

    if (this.global.stellarSDK.rpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }

    const result = this.global.stellarSDK.scValToNative(sim.result!.retval);

    if (!result) {
      throw new ReverseDomain404Error();
    }

    const tld: string = result.tld.toString();
    const sld: string = result.sld.toString();
    const subs: string = result.subs.map((buf: ArrayBuffer) => buf.toString()).join(".");
    return `${subs ? subs + "." : ""}${sld}.${tld}`;
  }
}
