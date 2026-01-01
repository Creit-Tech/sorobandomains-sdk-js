An SDK to search registered domains in the Registry Smart Contract from the [SorobanDomains](https://sorobandomains.org)
protocol

## Installation

```shell
npx jsr add @creit-tech/sorobandomains-sdk
```

> If you are using another tool like Deno, Bun or PNPM; check the installation instructions
> [here](https://jsr.io/@creit-tech/sorobandomains-sdk).

## The SorobanDomainsSDK class

The first step will be creating a new instance from the main class.

```typescript
const sdk: SorobanDomainsSDK = new SorobanDomainsSDK();
```

> There are more parameters you can provide to the SDK, check the `SorobanDomainsSDKParams` interface in the
> [src/types.ts](https://github.com/Creit-Tech/sorobandomains-sdk-js/blob/main/src/types.ts) file to know all of them.

## Fetch a registered domain

```typescript
import { Domain, SubDomain } from "@creit.tech/sorobandomains-sdk";

const domainRecord: Domain = await sdk.searchDomain("jhon.xlm");
const subDomainRecord: SubDomain = await sdk.searchDomain("payments.jhon.xlm");
```

This method will fail in two cases:

- The domain doesn't exist
- The domain is expired.

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

Licensed under the MIT License, Copyright © 2026-present Creit Tech.

Checkout the `LICENSE.md` file for more details.
