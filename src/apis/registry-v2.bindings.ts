import { Buffer } from "buffer";
import type { Option, u32, u64 } from "@stellar/stellar-sdk/contract";
import {
  type AssembledTransaction,
  Client as ContractClient,
  type ClientOptions as ContractClientOptions,
  type MethodOptions,
  type Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";

export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  globalThis.Buffer = globalThis.Buffer || Buffer;
}

export const RegistryV2Errors = {
  300: { message: "UnexpectedError" },
  301: { message: "InvalidDomain" },
  302: { message: "InvalidSubDomain" },
  303: { message: "UnsupportedTLD" },
  304: { message: "DomainAlreadyExist" },
  305: { message: "PaymentFailed" },
  306: { message: "MintingTokenFailed" },
  307: { message: "RecordDoesntExist" },
  308: { message: "RecordIsExpired" },
  309: { message: "BurningTokenFailed" },
  310: { message: "RecordCantBeClaimedYet" },
  311: { message: "V1DomainRegistered" },
  312: { message: "InvalidV1Domain" },
  313: { message: "V1DomainMigrationExpired" },
};

export interface Domain {
  address: string;
  domain: Buffer;
  exp_date: u64;
  node: Buffer;
  snapshot: u64;
  tld: Buffer;
  token_id: u32;
}

export type RecordKey = { tag: "Domain"; values: readonly [Buffer] } | {
  tag: "SubDomain";
  values: readonly [Buffer];
};

export interface SubDomain {
  address: string;
  domain: Buffer;
  node: Buffer;
  parent: Buffer;
  root: Buffer;
  snapshot: u64;
}

export type RegistryStorageKeys =
  | { tag: "Index"; values: void }
  | { tag: "Admin"; values: void }
  | { tag: "Oracle"; values: void }
  | { tag: "PayingAsset"; values: void }
  | { tag: "TLDs"; values: void }
  | { tag: "NFD"; values: void }
  | { tag: "Domain"; values: readonly [Buffer] }
  | { tag: "SubDomain"; values: readonly [Buffer] }
  | { tag: "Treasury"; values: void }
  | { tag: "V1Registry"; values: void }
  | { tag: "V1MaxSnapshot"; values: void }
  | { tag: "V1Deadline"; values: void };

export interface RegistryV2Client {
  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim: (
    { caller, node, address, periods }: { caller: string; node: Buffer; address: string; periods: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Domain>>>;

  /**
   * Construct and simulate a evict transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  evict: ({ node }: { node: Buffer }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a renew transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  renew: (
    { caller, node, periods }: { caller: string; node: Buffer; periods: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Domain>>>;

  /**
   * Construct and simulate a record transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record: (
    { record_key }: { record_key: RecordKey },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<readonly [Domain, Option<SubDomain>]>>>;

  /**
   * Construct and simulate a migrate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  migrate: (
    { new_domain, tld }: { new_domain: Buffer; tld: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Domain>>>;

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({ hash }: { hash: Buffer }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register: (
    { new_domain, tld, owner, address, periods }: {
      new_domain: Buffer;
      tld: Buffer;
      owner: string;
      address: string;
      periods: u64;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<Domain>>>;

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a parse_domain transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  parse_domain: (
    { domain, tld }: { domain: Buffer; tld: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Buffer>>;

  /**
   * Construct and simulate a register_sub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_sub: (
    { parent, new_subdomain, address }: { parent: RecordKey; new_subdomain: Buffer; address: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<SubDomain>>>;

  /**
   * Construct and simulate a update_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_address: (
    { record_key, new_address }: { record_key: RecordKey; new_address: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a update_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_treasury: (
    { new_treasury }: { new_treasury: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
}

export class RegistryV2Client extends ContractClient {
  // deno-lint-ignore require-await
  static override async deploy<T = RegistryV2Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { new_admin, new_oracle, new_paying_asset, new_tlds, new_nfd, v1_registry }: {
      new_admin: string;
      new_oracle: string;
      new_paying_asset: string;
      new_tlds: Array<Buffer>;
      new_nfd: string;
      v1_registry: string;
    },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options:
      & MethodOptions
      & Omit<ContractClientOptions, "contractId">
      & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ new_admin, new_oracle, new_paying_asset, new_tlds, new_nfd, v1_registry }, options);
  }

  constructor(public override readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAABAAAAAAAAAAAAAAAEFJlZ2lzdHJ5VjJFcnJvcnMAAAAOAAAAAAAAAA9VbmV4cGVjdGVkRXJyb3IAAAABLAAAAAAAAAANSW52YWxpZERvbWFpbgAAAAAAAS0AAAAAAAAAEEludmFsaWRTdWJEb21haW4AAAEuAAAAAAAAAA5VbnN1cHBvcnRlZFRMRAAAAAABLwAAAAAAAAASRG9tYWluQWxyZWFkeUV4aXN0AAAAAAEwAAAAAAAAAA1QYXltZW50RmFpbGVkAAAAAAABMQAAAAAAAAASTWludGluZ1Rva2VuRmFpbGVkAAAAAAEyAAAAAAAAABFSZWNvcmREb2VzbnRFeGlzdAAAAAAAATMAAAAAAAAAD1JlY29yZElzRXhwaXJlZAAAAAE0AAAAAAAAABJCdXJuaW5nVG9rZW5GYWlsZWQAAAAAATUAAAAAAAAAFlJlY29yZENhbnRCZUNsYWltZWRZZXQAAAAAATYAAAAAAAAAElYxRG9tYWluUmVnaXN0ZXJlZAAAAAABNwAAAAAAAAAPSW52YWxpZFYxRG9tYWluAAAAATgAAAAAAAAAGFYxRG9tYWluTWlncmF0aW9uRXhwaXJlZAAAATk=",
        "AAAABQAAAAAAAAAAAAAAC0NsYWltUmVjb3JkAAAAAAIAAAAFQ0xBSU0AAAAAAAAGRE9NQUlOAAAAAAAFAAAAAAAAAARub2RlAAAD7gAAACAAAAABAAAAAAAAAAhyZWdpc3RlcgAAABMAAAAAAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAAAAAAAAhleHBfZGF0ZQAAAAYAAAAAAAAAAAAAAAthbW91bnRfcGFpZAAAAAAKAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC1JlbmV3RG9tYWluAAAAAAIAAAAFUkVORVcAAAAAAAAGRE9NQUlOAAAAAAAEAAAAAAAAAARub2RlAAAD7gAAACAAAAABAAAAAAAAAAVwYXllcgAAAAAAABMAAAAAAAAAAAAAAAthbW91bnRfcGFpZAAAAAAKAAAAAAAAAAAAAAAIZXhwX2RhdGUAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADFVwZGF0ZVJlY29yZAAAAAIAAAAGVVBEQVRFAAAAAAAGUkVDT1JEAAAAAAADAAAAAAAAAARub2RlAAAD7gAAACAAAAABAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAI=",
        "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",
        "AAAAAAAAAAAAAAAId2l0aGRyYXcAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAMcGFyc2VfZG9tYWluAAAAAgAAAAAAAAAGZG9tYWluAAAAAAAOAAAAAAAAAAN0bGQAAAAADgAAAAEAAAPuAAAAIA==",
        "AAAAAAAAAAAAAAAMcmVnaXN0ZXJfc3ViAAAAAwAAAAAAAAAGcGFyZW50AAAAAAfQAAAACVJlY29yZEtleQAAAAAAAAAAAAANbmV3X3N1YmRvbWFpbgAAAAAAAA4AAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAEAAAPpAAAH0AAAAAlTdWJEb21haW4AAAAAAAfQAAAAEFJlZ2lzdHJ5VjJFcnJvcnM=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAYAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAAAAAACm5ld19vcmFjbGUAAAAAABMAAAAAAAAAEG5ld19wYXlpbmdfYXNzZXQAAAATAAAAAAAAAAhuZXdfdGxkcwAAA+oAAAAOAAAAAAAAAAduZXdfbmZkAAAAABMAAAAAAAAAC3YxX3JlZ2lzdHJ5AAAAABMAAAAA",
        "AAAAAAAAAAAAAAAOdXBkYXRlX2FkZHJlc3MAAAAAAAIAAAAAAAAACnJlY29yZF9rZXkAAAAAB9AAAAAJUmVjb3JkS2V5AAAAAAAAAAAAAAtuZXdfYWRkcmVzcwAAAAATAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAAQUmVnaXN0cnlWMkVycm9ycw==",
        "AAAAAAAAAAAAAAAPdXBkYXRlX3RyZWFzdXJ5AAAAAAEAAAAAAAAADG5ld190cmVhc3VyeQAAABMAAAAA",
      ]),
      options,
    );
  }

  public readonly fromJSON: object = {
    claim: this.txFromJSON<Result<Domain>>,
    evict: this.txFromJSON<Result<void>>,
    renew: this.txFromJSON<Result<Domain>>,
    record: this.txFromJSON<Result<readonly [Domain, Option<SubDomain>]>>,
    migrate: this.txFromJSON<Result<Domain>>,
    upgrade: this.txFromJSON<null>,
    register: this.txFromJSON<Result<Domain>>,
    withdraw: this.txFromJSON<null>,
    parse_domain: this.txFromJSON<Buffer>,
    register_sub: this.txFromJSON<Result<SubDomain>>,
    update_address: this.txFromJSON<Result<void>>,
    update_treasury: this.txFromJSON<null>,
  };
}
