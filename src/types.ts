import type { Networks } from "@stellar/stellar-sdk";

export const SIMULATION_ACCOUNT: string = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";

export enum RegistryContract {
  v0 = "CATRNPHYKNXAPNLHEYH55REB6YSAJLGCPA4YM6L3WUKSZOPI77M2UMKI",
}

export enum KeyValueDbContract {
  v0 = "CDH2T2CBGFPFNVRWFK4XJIRP6VOWSVTSDCRBCJ2TEIO22GADQP6RG3Y6",
}

export enum ReverseRegistrarContract {
  v0 = "CCAU556HKCUXF4LBPUV2KROU5FYGC6227G2LD3SVQ6GR6654IVTO2GBO",
}

export interface SorobanDomainsSDKParams {
  /**
   * A URL of the RPC to use, this value is required for methods that need to connect with the network
   */
  rpcUrl?: string;

  /**
   * The registry contract ID of the protocol you want to connect to.
   * Check the current ids here: https://www.sorobandomains.org/docs/apps_and_contracts
   */
  registryContractId?: string;

  /**
   * The Contract ID of the Key-Value database contract.
   * Check the current ids here: https://www.sorobandomains.org/docs/apps_and_contracts
   */
  keyValuesDatabaseContractId?: string;

  /**
   * The Contract ID of the Reverse Registrar contract.
   */
  // TODO: Add link to the documentation of the Reverse Registrar contract
  reverseRegistrarContractId?: string;

  /**
   * The simulation account is just a simple stellar account
   * The account needs to be funded, but it doesn't matter if you have or not the secret key of this account
   */
  simulationAccount?: string;

  /**
   * The network passphrase the RPC is using
   */
  network?: Networks;

  /**
   * The default fee you want to use when building transactions
   * NOTE: This is not really being used at the moment, is here just for future usage
   */
  defaultFee?: string;

  /**
   * The default timeout you want to use when building transactions
   * NOTE: This is not really being used at the moment, is here just for future usage
   */
  defaultTimeout?: number;
}

export interface Domain {
  // The `node` is the hash of the domain following the logic used by the function `generate_domain_node`
  node: string;

  // The owner of the node above and the address who can make updates
  owner: string;

  // The address is where the node resolves to
  address: string;

  // The TTL is the end expiration date of the domain.
  // A domain that have been expired for at least 30 days can be claimed by another address
  exp_date: string;

  // The collateral is the amount of reserves the owner of the domain has deposited
  // For example; if the `node_rate` is 1 unit of collateral and the min ttl is a year then the collateral amount is:
  // 1 * (3600 * 24 * 365) = 3.1536000 XLM
  collateral: string;

  // The snapshot is a value used as a flag for checking if other records are valid
  // The snapshot is the timestamp it was created
  snapshot: string;
}

export interface SubDomain {
  // The node is the hash of the subdomain
  node: string;

  // Parent is the hash of the root of the domain
  parent: string;

  // The address is where the node resolves to
  address: string;

  // The snapshot is taken from the parent domain
  // If the subdomain snapshot is different from the parent one, it means the subdomain is invalid
  snapshot: string;
}

export enum RecordKey {
  Record = "Record",
  SubRecord = "SubRecord",
}

export enum RecordType {
  Domain = "Domain",
  SubDomain = "SubDomain",
}
export type Record = { type: RecordType.Domain; value: Domain } | { type: RecordType.SubDomain; value: SubDomain };

export type DomainStorageValue = ["String", string] | ["Bytes", ArrayBufferLike] | ["Number", bigint];
export enum DefaultStorageKeys {
  TOML = "TOML",
  TOML_HASH = "TOML_HASH",
  WEBSITE = "WEBSITE",
  WEBSITE_IPFS = "WEBSITE_IPFS",
  WEBSITE_IPNS = "WEBSITE_IPNS",
}
