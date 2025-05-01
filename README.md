An SDK to search registered domains in the Registry Smart Contract from the [SorobanDomains](https://sorobandomains.org)
protocol

## Installation

```shell
npx jsr add @creit-tech/sorobandomains-sdk
```
> If you are using another tool like Deno, Bun or PNPM; check the installation instructions [here](https://jsr.io/@creit-tech/sorobandomains-sdk). 

## The SorobanDomainsSDK class

The first step will be creating a new instance from the main class.

```typescript
import * as SDK from "@stellar/stellar-sdk";
import config from "./myconfigfile.ts";

const sdk: SorobanDomainsSDK = new SorobanDomainsSDK({
  stellarSDK: SDK,
  rpc: new SDK.rpc.Server(config.RPC_URL),
  network: config.NETWORK,
  vaultsContractId: config.VAULTS_CONTRACT_ID,
  valuesDatabaseContractId: config.VALUES_DATABASE_CONTRACT_ID,
  reverseRegistrarContractId: config.REVERSE_REGISTRAR_CONTRACT_ID,
  defaultFee: config.DEFAULT_FEE,
  defaultTimeout: config.DEFAULT_TIMEOUT,
  simulationAccount: config.SIMULATION_ACCOUNT,
});
```

> If you want to know what each value represents, check the `SorobanDomainsSDKParams` interface in the `./src/types.ts`
> file.

## Fetch a registered domain

```typescript
import { Record } from "@creit.tech/sorobandomains-sdk";

const domainRecord: Record = await sdk.searchDomain({ domain: "jhon" });
const subDomainRecord: Record = await sdk.searchDomain({ domain: "jhon", subDomain: "payments" });
```

When searching for a domain, you can receive two types of errors: an expected error by the SDK or a simulation error.
Currently, there is only one expected error by the SDK: `Domain404Error`.

If you need to catch this type of error you can do this:

```typescript
import { Domain404Error } from "@creit.tech/sorobandomains-sdk";

try {
  const domainRecord: Record = await sdk.searchDomain({ domain: "nonexistingrecord" });
} catch (e) {
  if (e.name === Domain404Error.name) {
    // ... Do something here
  } else {
    // ... Do this instead
  }
}
```

> Note: In the example we check by the name and not if is an instance of the class because depending on your environment
> that validation method could fail.

## Fetch the reverse domain of an address

Before fetching the reverse domain of an address, you need to set `reverseRegistrarContractId` in the
`SorobanDomainsSDK` constructor.

```typescript
import { ReverseDomain404Error } from "@creit.tech/sorobandomains-sdk";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

try {
  const domain: string = await sdk.getReverseDomain(address);
} catch (e) {
  if (e.name === ReverseDomain404Error.name) {
    // ... Do something here
  } else {
    // ... Do this instead
  }
}
```

## License

![](https://img.shields.io/badge/License-MIT-lightgrey)

Licensed under the MIT License, Copyright © 2024-present Creit Technologies LLP.

Checkout the `LICENSE.md` file for more details.
