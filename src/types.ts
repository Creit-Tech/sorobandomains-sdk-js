import {
  Contract,
  xdr,
  TransactionBuilder,
  SorobanRpc,
  Networks,
  scValToNative,
  nativeToScVal,
} from '@stellar/stellar-sdk';

export interface SorobanDomainsSDKParams {
  /**
   * These are all from the Stellar SDK, import them and pass them to the object.
   * This is done this way because the `@stellar/stellar-sdk` package and its dependencies rely a lot on `instance of` logic,
   * that means that we need to use the same objects everytime we can so we avoid issues in those conditions.
   */
  stellarSDK: {
    Contract: typeof Contract;
    xdr: typeof xdr;
    TransactionBuilder: typeof TransactionBuilder;
    SorobanRpc: typeof SorobanRpc;
    scValToNative: typeof scValToNative;
    nativeToScVal: typeof nativeToScVal;
  };

  /**
   * @deprecated use `vaultsContractId` instead, this will be removed in the future.
   */
  contractId?: string;

  /**
   * The Vaults contract ID of the protocol you want to connect to.
   * Check the current ids here: https://www.sorobandomains.org/docs/apps_and_contracts
   */
  vaultsContractId?: string;

  /**
   * The Contract ID of the Key-Value storage contract.
   * Check the current ids here: https://www.sorobandomains.org/docs/apps_and_contracts
   */
  valuesDatabaseContractId?: string;

  /**
   * The Contract ID of the Reverse Registrar contract.
   */
  // TODO: Add link to the documentation of the Reverse Registrar contract
  reverseRegistrarContractId?: string;

  /**
   * An instance of the rpc server you will connect to.
   */
  rpc: SorobanRpc.Server;

  /**
   * The simulation account is just a simple stellar account
   * The account needs to be funded, but it doesn't matter if you have or not the secret key of this account
   */
  simulationAccount: string;

  /**
   * The network passphrase the RPC is using
   */
  network: Networks;

  /**
   * The default fee you want to use when building transactions
   * NOTE: This is not really being used at the moment, is here just for future usage
   */
  defaultFee: string;

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
  Record = 'Record',
  SubRecord = 'SubRecord',
}

export enum RecordType {
  Domain = 'Domain',
  SubDomain = 'SubDomain',
}
export type Record = { type: RecordType.Domain; value: Domain } | { type: RecordType.SubDomain; value: SubDomain };

export type DomainStorageValue = ['String', string] | ['Bytes', Buffer] | ['Number', bigint];
export enum DefaultStorageKeys {
  TOML = 'TOML',
  TOML_HASH = 'TOML_HASH',
  WEBSITE = 'WEBSITE',
  WEBSITE_IPFS = 'WEBSITE_IPFS',
  WEBSITE_IPNS = 'WEBSITE_IPNS',
}
