import {
  type Domain,
  type DomainStorageValue,
  KEY_VALUE_DB_CONTRACT,
  NFD_CONTRACT,
  RecordKey,
  REGISTRY_CONTRACT,
  REVERSE_REGISTRAR_CONTRACT,
  SIMULATION_ACCOUNT,
  type SorobanDomainsSDKParams,
  type SubDomain,
} from "./types.ts";
import { Buffer } from "buffer";
import { crypto } from "@std/crypto";
import { concat } from "@std/bytes";
import { DomainData404Error, DomainDataUnsupportedValueType, ReverseDomain404Error } from "./errors.ts";
import {
  Account,
  Address,
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
import { RegistryV2Client, RegistryV2Errors } from "./apis/mod.ts";
import { StellarAssetsSdk } from "@creit-tech/stellar-assets-sdk";

export class SorobanDomainsSDK {
  readonly #rpcUrl?: string;
  readonly #allowHttp?: boolean;
  readonly #simulationAccount: string;
  readonly #globalFee: string;
  readonly #registryContract: string;
  readonly #keyValueDbContract: string;
  readonly #reverseRegistrarContract: string;
  readonly #network: Networks;
  readonly #defaultTimeout: number;

  readonly registryV2Client: RegistryV2Client;

  static assertContractError(sim: rpc.Api.SimulateTransactionResponse): void {
    if (rpc.Api.isSimulationError(sim)) {
      const { message } = (RegistryV2Errors as any)[Number(sim.error.split("\n")[0].replace(/\D/g, ""))];
      throw new Error(message);
    }
  }

  get server(): rpc.Server {
    if (!this.#rpcUrl) {
      throw new Error("This method requires that you define an `rpcUrl` value.");
    }

    return new rpc.Server(this.#rpcUrl);
  }

  constructor(params: SorobanDomainsSDKParams = {}) {
    this.#rpcUrl = params.rpcUrl || "https://rpc.lightsail.network";
    this.#allowHttp = !!params.allowHttp;
    this.#simulationAccount = params.simulationAccount || SIMULATION_ACCOUNT;
    this.#globalFee = params.defaultFee || "100000";
    this.#registryContract = params.registryContractId || REGISTRY_CONTRACT;
    this.#keyValueDbContract = params.keyValuesDatabaseContractId || KEY_VALUE_DB_CONTRACT;
    this.#reverseRegistrarContract = params.reverseRegistrarContractId || REVERSE_REGISTRAR_CONTRACT;
    this.#network = params.network || Networks.PUBLIC;
    this.#defaultTimeout = params.defaultTimeout || 0;

    this.registryV2Client = new RegistryV2Client({
      contractId: this.#registryContract,
      networkPassphrase: this.#network,
      rpcUrl: this.#rpcUrl,
      allowHttp: this.#allowHttp,
    });
  }

  static hash(text: string | Uint8Array): Uint8Array {
    const data = (typeof text === "string" ? new TextEncoder().encode(text) : text) as Uint8Array<ArrayBuffer>;
    return new Uint8Array(crypto.subtle.digestSync("KECCAK-256", data));
  }

  /**
   * This function takes a domain and generates the "node" value of the parsed domain.
   * This "node" value can be used to fetch data from the contract
   *
   * You need to provide the chunks in reverse, so for example the domain "treasury.addresses.protocol.xlm" the params will be:
   * - domainChunks: the bytes in the order ["protocol", "addresses","treasury"]
   * - tld: "xlm"
   */
  static generateNode(domainChunks: Array<Uint8Array | string>, tld: Uint8Array | string): Uint8Array {
    if (domainChunks.length < 1) {
      throw new Error("Domain chunks must be at least size 1");
    }
    const chunks = [...domainChunks];
    let node: Uint8Array = this.hash(concat([
      this.hash(tld),
      this.hash(chunks.shift()!),
    ]));
    while (chunks.length > 0) {
      node = this.hash(concat([
        this.hash(node),
        this.hash(chunks.shift()!),
      ]));
    }
    return node;
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
    return parts.every((part: string): boolean => part.length <= 15 && part.length >= 1);
  }

  /**
   * This method will take a domain, validate it and generate the reversed chunks this library use.
   *
   * @param domain {String} - The domain to separate in chunks
   */
  static generateDomainChunks(domain: string): string[] {
    this.isValidDomain(domain);
    const domainChunks: string[] = domain.split(".").toReversed();
    if (domainChunks.length < 2) {
      throw new Error(
        "Domain is not long enough, remember that you need to include at least the TLD and the root domain",
      );
    }
    return domainChunks;
  }

  /**
   * This method is used to register a new domain or subdomain.
   *
   * @param params {Object}
   * @param params.domain {String} - The domain to register, for example: hello.mate.xlm
   * @param params.owner {String|Undefined} - The account that will receive the NFD token; Not needed if you are registering a subdomain, if not provided then the "address" will be used
   * @param params.address {String} - The address to which this domain will translate to
   * @param params.periods {String} - Amount of years the domain will be registered
   * @param params.source {String} - The Stellar account which will sign and pay for the Transaction fee
   */
  async register(params: {
    domain: string;
    owner?: string;
    address: string;
    periods?: bigint;
    source: string;
  }): Promise<Transaction> {
    this.registryV2Client.options.publicKey = params.source;
    const domainChunks: string[] = SorobanDomainsSDK.generateDomainChunks(params.domain);
    const tld: string = domainChunks.shift()!;

    if (domainChunks.length > 1) {
      const subdomain: string = domainChunks.pop()!;
      const parentNode: Uint8Array = SorobanDomainsSDK.generateNode(domainChunks, tld);
      const { built, simulation } = await this.registryV2Client.register_sub({
        address: params.address,
        new_subdomain: Buffer.from(subdomain),
        parent: {
          values: [Buffer.from(parentNode)],
          tag: domainChunks.length > 1 ? "SubDomain" : "Domain",
        },
      }, {
        fee: this.#globalFee,
        simulate: true,
        timeoutInSeconds: 0,
      });

      SorobanDomainsSDK.assertContractError(simulation!);
      return built!;
    } else {
      const { built, simulation } = await this.registryV2Client.register({
        new_domain: Buffer.from(domainChunks[0]),
        tld: Buffer.from(tld),
        address: params.address,
        owner: params.owner || params.address,
        periods: params.periods || 1n,
      }, {
        fee: this.#globalFee,
        simulate: true,
        timeoutInSeconds: 0,
      });

      SorobanDomainsSDK.assertContractError(simulation!);
      return built!;
    }
  }

  /**
   * This method is used to update the address at which a domain points to.
   *
   * @param params {Object}
   * @param params.domain {String} - The domain we will update, for example: hello.mate.xlm
   * @param params.newAddress {String} - The new address
   * @param params.source {String} - The Stellar account which will sign and pay for the Transaction fee
   */
  async updateAddress(params: {
    domain: string;
    newAddress: string;
    source: string;
  }): Promise<Transaction> {
    this.registryV2Client.options.publicKey = params.source;
    const domainChunks: string[] = SorobanDomainsSDK.generateDomainChunks(params.domain);
    const tld: string = domainChunks.shift()!;
    const node: Uint8Array = SorobanDomainsSDK.generateNode(domainChunks, tld);
    const { built, simulation } = await this.registryV2Client.update_address({
      new_address: params.newAddress,
      record_key: {
        values: [Buffer.from(node)],
        tag: domainChunks.length > 1 ? "SubDomain" : "Domain",
      },
    }, {
      fee: this.#globalFee,
      simulate: true,
      timeoutInSeconds: 0,
    });

    SorobanDomainsSDK.assertContractError(simulation!);
    return built!;
  }

  /**
   * This method is used to extend the registration period for a domain. This can be called by anyone and extend a domain.
   * Be aware that if you extend a domain that it is not near the expiration date, you will only extend it from the moment you call the method, not including any possible period left that was already paid.
   *
   * @param params {Object}
   * @param params.payer {String} - The account that will pay for the extension of the domain registration
   * @param params.domain {String} - The domain to extend, it needs tobe only the root domain and the tld. For example sorobandomains.xlm
   * @param params.periods {String} - Amount of years the domain will be extended
   * @param params.source {String} - The Stellar account which will sign and pay for the Transaction fee
   */
  async renew(params: {
    payer: string;
    domain: string;
    periods: number;
    source: string;
  }): Promise<Transaction> {
    this.registryV2Client.options.publicKey = params.source;
    const domainChunks: string[] = SorobanDomainsSDK.generateDomainChunks(params.domain);
    const tld: string = domainChunks.shift()!;
    const node: Uint8Array = SorobanDomainsSDK.generateNode(domainChunks, tld);
    const { built, simulation } = await this.registryV2Client.renew({
      caller: params.payer,
      node: Buffer.from(node),
      periods: BigInt(params.periods),
    }, {
      fee: this.#globalFee,
      simulate: true,
      timeoutInSeconds: 0,
    });

    SorobanDomainsSDK.assertContractError(simulation!);
    return built!;
  }

  /**
   * This method can be called by someone to claim a domain that had been 30 days expired.
   *
   * @param params {Object}
   * @param params.buyer {String} - The account that will pay to claim the domain
   * @param params.domain {String} - The domain to extend, it needs tobe only the root domain and the tld. For example sorobandomains.xlm
   * @param params.address {String} - The address to which this domain will translate to
   * @param params.periods {String} - Amount of years the domain will be extended
   * @param params.source {String} - The Stellar account which will sign and pay for the Transaction fee
   */
  async claim(params: {
    buyer: string;
    domain: string;
    address: string;
    periods: number;
    source: string;
  }): Promise<Transaction> {
    this.registryV2Client.options.publicKey = params.source;
    const domainChunks: string[] = SorobanDomainsSDK.generateDomainChunks(params.domain);
    const tld: string = domainChunks.shift()!;
    const node: Uint8Array = SorobanDomainsSDK.generateNode(domainChunks, tld);
    const { built, simulation } = await this.registryV2Client.claim({
      caller: params.buyer,
      node: Buffer.from(node),
      address: params.address,
      periods: BigInt(params.periods),
    }, {
      fee: this.#globalFee,
      simulate: true,
      timeoutInSeconds: 0,
    });

    SorobanDomainsSDK.assertContractError(simulation!);
    return built!;
  }

  /**
   * This method is used by the admin to burn a domain.
   *
   * @param params {Object}
   * @param params.domain {String} - The domain to extend, it needs tobe only the root domain and the tld. For example sorobandomains.xlm
   * @param params.source {String} - The Stellar account which will sign and pay for the Transaction fee
   */
  async evict(params: {
    domain: string;
    source: string;
  }): Promise<Transaction> {
    this.registryV2Client.options.publicKey = params.source;
    const domainChunks: string[] = SorobanDomainsSDK.generateDomainChunks(params.domain);
    const tld: string = domainChunks.shift()!;
    const node: Uint8Array = SorobanDomainsSDK.generateNode(domainChunks, tld);
    const { built, simulation } = await this.registryV2Client.evict({
      node: Buffer.from(node),
    }, {
      fee: this.#globalFee,
      simulate: true,
      timeoutInSeconds: 0,
    });

    SorobanDomainsSDK.assertContractError(simulation!);
    return built!;
  }

  /**
   * This method is used to migrate a domain from the Registry V1 to this new Registry.
   *
   * @param params {Object}
   * @param params.domain {String} - The root domain to migrate, for example: mate.xlm
   * @param params.source {String} - The Stellar account which will sign and pay for the Transaction fee
   */
  async migrateFromV1(params: {
    domain: string;
    source: string;
  }): Promise<Transaction> {
    this.registryV2Client.options.publicKey = params.source;
    const [tld, domain]: string[] = params.domain.split(".").toReversed().map((item: string): string =>
      item.trim().toLowerCase()
    );
    const { built, simulation } = await this.registryV2Client.migrate({
      new_domain: Buffer.from(domain),
      tld: Buffer.from(tld),
    }, {
      fee: this.#globalFee,
      simulate: true,
      timeoutInSeconds: 0,
    });

    SorobanDomainsSDK.assertContractError(simulation!);
    return built!;
  }

  /**
   * @param domain {String} - The domain we will get from the registry, for example: my.mate.xlm
   */
  async searchDomain<Domain>(domain: string): Promise<Domain>;
  async searchDomain<SubDomain>(domain: string): Promise<SubDomain>;
  async searchDomain(domain: string): Promise<Domain | SubDomain> {
    const domainChunks: string[] = SorobanDomainsSDK.generateDomainChunks(domain);
    const tld: string = domainChunks.shift()!;
    const node: Uint8Array = SorobanDomainsSDK.generateNode(domainChunks, tld);
    const tx: Transaction = new TransactionBuilder(new Account(SIMULATION_ACCOUNT, "0"), {
      networkPassphrase: this.#network,
      fee: "0",
    }).setTimeout(0)
      .addOperation(
        new Contract(this.#registryContract).call(
          "record",
          xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol(domainChunks.length > 1 ? "SubDomain" : "Domain"),
            xdr.ScVal.scvBytes(node),
          ]),
        ),
      )
      .build();

    const sim = await this.server.simulateTransaction(tx);

    SorobanDomainsSDK.assertContractError(sim);

    if (rpc.Api.isSimulationSuccess(sim)) {
      const [domain, subDomain] = scValToNative(sim.result!.retval);
      if (subDomain) {
        return {
          type: RecordKey.SubDomain,
          address: subDomain.address,
          domain: subDomain.domain.toString(),
          parent: subDomain.parent.toString("hex"),
          root: subDomain.root.toString("hex"),
          node: subDomain.node.toString("hex"),
          snapshot: Number(subDomain.snapshot),
        } satisfies SubDomain;
      } else {
        return {
          type: RecordKey.Domain,
          address: domain.address,
          domain: domain.domain.toString(),
          tld: domain.tld.toString(),
          node: domain.node.toString("hex"),
          snapshot: Number(domain.snapshot),
          token_id: domain.token_id,
          exp_date: Number(domain.exp_date),
        } satisfies Domain;
      }
    }

    throw new Error("Unexpected Error, please contact support");
  }

  /**
   * This method will search for all the domains an account hold, it will do this by fetching all issued NFDs and check those the account own
   */
  async fetchAllDomains(owner: string): Promise<Domain[]> {
    if (!this.#rpcUrl) {
      throw new Error("This method requires that you define an `rpcUrl` value.");
    }
    const sdk: StellarAssetsSdk = new StellarAssetsSdk({ rpcUrl: this.#rpcUrl, networkPassphrase: this.#network });
    const tokenIds: number[] = await sdk.fetchOwnedNFTs(NFD_CONTRACT, owner);

    const nodesLedgersKeys: xdr.LedgerKey[] = [];
    for (const tokenId of tokenIds) {
      nodesLedgersKeys.push(xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: new Address(NFD_CONTRACT).toScAddress(),
          key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("TokenNode"), xdr.ScVal.scvU32(tokenId)]),
          durability: xdr.ContractDataDurability.persistent(),
        }),
      ));
    }

    const nodesResults: rpc.Api.LedgerEntryResult[] = [];
    while (nodesLedgersKeys.length > 0) {
      const chunk: xdr.LedgerKey[] = nodesLedgersKeys.splice(0, 200);
      const result: rpc.Api.GetLedgerEntriesResponse = await this.server.getLedgerEntries(...chunk);
      for (const entry of result.entries) {
        nodesResults.push(entry);
      }
    }

    const nodes: Array<Buffer> = [];
    for (const result of nodesResults) {
      nodes.push(scValToNative(result.val.contractData().val()));
    }

    const domainsLedgersKeys: xdr.LedgerKey[] = [];
    for (const node of nodes) {
      domainsLedgersKeys.push(xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: new Address(REGISTRY_CONTRACT).toScAddress(),
          key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Domain"), xdr.ScVal.scvBytes(node)]),
          durability: xdr.ContractDataDurability.persistent(),
        }),
      ));
    }

    const results: rpc.Api.LedgerEntryResult[] = [];
    while (domainsLedgersKeys.length > 0) {
      const chunk: xdr.LedgerKey[] = domainsLedgersKeys.splice(0, 200);
      const result: rpc.Api.GetLedgerEntriesResponse = await this.server.getLedgerEntries(...chunk);
      for (const entry of result.entries) {
        results.push(entry);
      }
    }

    const domains: Array<any> = [];
    for (const result of results) {
      domains.push(scValToNative(result.val.contractData().val()));
    }

    return domains.map((domain): Domain => ({
      type: RecordKey.Domain,
      address: domain.address,
      domain: domain.domain.toString(),
      tld: domain.tld.toString(),
      node: domain.node.toString("hex"),
      snapshot: Number(domain.snapshot),
      token_id: domain.token_id,
      exp_date: Number(domain.exp_date),
    }));
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
