import { SorobanDomainsSDK } from "./sdk.ts";
import { describe, test } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { decodeHex } from "@std/encoding";
import { type Record, RecordType } from "./types.ts";

describe("Basic logic", (): void => {
  test("The `hash` function", () => {
    const xlm: string = "745bb28999b7d22e04ecc9719a460ca08b4c0ac2044adf23ad2bb4db8f8eaf6b";
    assertEquals(SorobanDomainsSDK.hash("xlm"), decodeHex(xlm));

    const payments: string = "be67d0b990c3ddd3b6a1240499a283c618381d713b4af1237f1c9e318e5102a6";
    assertEquals(SorobanDomainsSDK.hash("payments"), decodeHex(payments));
  });

  test("It should generate the correct domain node", (): void => {
    const expectedNode: string = "2fe4cc6a15f9466bad71ed407a8f1b7da81efd931e7712753152aa17abc0e06e";
    const generatedNode: string = SorobanDomainsSDK.parseDomain({ domain: "stellar" });
    assertEquals(expectedNode, generatedNode);

    const expectedSubNode: string = "c5e4e1b82ef754efdad5c3ce2f1ed0eb7d640076e1674aebc6b9419fe11b2e7a";
    const generatedSubNode: string = SorobanDomainsSDK.parseDomain({ domain: "stellar", subDomain: "payments" });
    assertEquals(expectedSubNode, generatedSubNode);
  });

  test("It should validate domains correctly", (): void => {
    assertEquals(true, SorobanDomainsSDK.isValidDomain("stellar.xlm"));
    assertEquals(true, SorobanDomainsSDK.isValidDomain("dev.stellar.xlm"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain("another.dev.stellar.xlm"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain("stellar"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain("stellar..xlm"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain(" stellar.xlm"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain("qwertyuiopasdfghjklzxcvbnm.xlm"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain("hello-world.xlm"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain("steLLar.xlm"));
    assertEquals(false, SorobanDomainsSDK.isValidDomain("ste11ar.xlm"));
  });
});

describe("Connection with public registry", () => {
  test("Search an existing domain", async () => {
    const now: number = performance.now();
    const sdk: SorobanDomainsSDK = new SorobanDomainsSDK({ rpcUrl: "https://mainnet.sorobanrpc.com" });
    const domain: Record = await sdk.searchDomain({ domain: "tomer" });
    assertEquals(domain.type, RecordType.Domain);
    const then: number = performance.now();

    console.log(`${(then - now).toFixed(2)}ms`);
  });
});
