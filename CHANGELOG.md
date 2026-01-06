# Changelog

All notable changes to this project will be documented in this file. See
[standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.0.2] (2026-01-06)

### Add

- Add parameter `type` to both the Domain and SubDomain to make it easy for developers consuming both from the library.

### [1.0.1] (2026-01-02)

### Add

- Add new `fetchAllDomains` method

### Change

- Add `exp_date` to the Domain
- change `snapshot` type from string to number

### [1.0.0] (2026-01-01)

This is a full upgrade and it's not compatible with the Registry V1.

### Change

- Full migration of the SDK to work with the new Registry V2
- The `parseDomain` method has been replaced by `generateNode`

### [0.6.0] (2025-09-03)

### Change

- Update the Stellar SDK for protocol 23

### [0.5.0] (2025-05-05)

### Change

- Remove the `stellarSDK` and the `rpc` instance so we start using the Stellar SDK directly now that recent versions
  don't fail like old ones with the "instance of" logic.
- Make as many constructor params as optional as possible, if they are not provided just use default values
- Avoid fetching the account in read only methods so calls are faster

### [0.3.0] (2025-05-01)

### Add

- Include new static method `isValidDomain`

### [0.2.0] (2025-03-30)

### Change

- Moving all the code to be fully Jsr and Deno compatible
- Remove node dependencies, update the Stellar SDK and include dependencies from the Standard Library from the Deno team
- Update tests to use new dependencies and remove tests relying on testnet TODO: create new tests that don't rely on
  network IE mock the results

### [0.1.6] (2024-01-16)

### Change

- Change all the `SorobanRpc` for `rpc` because the latest StellarSdk changed its variable name

### [0.1.5] (2024-01-16)

### Change

- Make domains and subdomains lowercase because the protocol doesn't accept uppercase digits
- Upgrade stellar SDK

### [0.1.4] (2024-11-06)

### Add

- Add support for the new Reverse Registrar contract proposed by @overcat
