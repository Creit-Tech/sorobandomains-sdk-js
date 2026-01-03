import type { Networks } from "@stellar/stellar-sdk";

export const SIMULATION_ACCOUNT: string = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";
export const REGISTRY_CONTRACT: string = "CC75Z72OCE667WVPQOROIWDAGBOXFNJ4VQONQEURL74EYIDLWA4F7FEN";
export const KEY_VALUE_DB_CONTRACT: string = "CDH2T2CBGFPFNVRWFK4XJIRP6VOWSVTSDCRBCJ2TEIO22GADQP6RG3Y6";
export const REVERSE_REGISTRAR_CONTRACT: string = "CCAU556HKCUXF4LBPUV2KROU5FYGC6227G2LD3SVQ6GR6654IVTO2GBO";
export const NFD_CONTRACT: string = "CADCRH6BW3MIZBBE7JOVKROR2GBEG64TJDT5Y3EX3OOIWRDZOOT5XUHD";

export interface SorobanDomainsSDKParams {
  /**
   * A URL of the RPC to use, this value is required for methods that need to connect with the network
   */
  rpcUrl?: string;
  allowHttp?: boolean;

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
  domain: string;
  tld: string;

  // The `node` is the hash of the domain following the logic used by the function `generate_domain_node`
  node: string;

  // This is the ID of the NFD token that represents the ownership of this domain
  token_id: number;

  // The address is where the node resolves to
  address: string;

  // The snapshot is a value used as a flag for checking if other records are valid
  // The snapshot is the timestamp it was created
  snapshot: number;

  // The date the domain will expire
  exp_date: number;
}

export interface SubDomain {
  // This is the subdomain value
  domain: string;

  // The node is the hash of the subdomain
  node: string;

  // Parent is the hash of the root of the domain
  parent: string;

  // The address is where the node resolves to
  address: string;

  // The node hash of the root domain
  root: string;

  // The snapshot is taken from the parent domain
  // If the subdomain snapshot is different from the parent one, it means the subdomain is invalid
  snapshot: number;
}

export enum RecordKey {
  Domain = "Domain",
  SubDomain = "SubDomain",
}

export type DomainStorageValue = ["String", string] | ["Bytes", ArrayBufferLike] | ["Number", bigint];

export enum DefaultStorageKeys {
  TOML = "TOML",
  TOML_HASH = "TOML_HASH",
  WEBSITE = "WEBSITE",
  WEBSITE_IPFS = "WEBSITE_IPFS",
  WEBSITE_IPNS = "WEBSITE_IPNS",
}
