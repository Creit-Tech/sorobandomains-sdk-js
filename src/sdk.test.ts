import { ReverseDomain404Error } from './errors';
import { SorobanDomainsSDK } from './sdk';
import * as SDK from '@stellar/stellar-sdk';

describe('Basic logic', (): void => {
  test('It should generate the correct domain node', (): void => {
    const expectedNode: string = '2fe4cc6a15f9466bad71ed407a8f1b7da81efd931e7712753152aa17abc0e06e';
    const generatedNode: string = SorobanDomainsSDK.parseDomain({ domain: 'stellar' });
    expect(expectedNode).toEqual(generatedNode);

    const expectedSubNode: string = 'c5e4e1b82ef754efdad5c3ce2f1ed0eb7d640076e1674aebc6b9419fe11b2e7a';
    const generatedSubNode: string = SorobanDomainsSDK.parseDomain({ domain: 'stellar', subDomain: 'payments' });
    expect(expectedSubNode).toEqual(generatedSubNode);
  });
});

// Relying on the data in the testnet, let's skip it for now.
describe.skip('Reverse Domain', () => {
  let sdk: SorobanDomainsSDK;

  beforeEach(() => {
    sdk = new SorobanDomainsSDK({
      stellarSDK: SDK,
      rpc: new SDK.rpc.Server('https://soroban-testnet.stellar.org'),
      network: SDK.Networks.TESTNET,
      reverseRegistrarContractId: 'CCZ5IJOVN6V6QH6THM67TEM4V32GE7DAYV6QJHIAEJ7SXYJ4RWZ7N3AV',
      defaultFee: '100000',
      defaultTimeout: 60,
      simulationAccount: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
  });

  describe('getReverseDomain', () => {
    test('domain', async () => {
      // SDNNCETFWJ3AGIR5MX6DVOIQVJK3OHHTGI2OOPTT7EEW2CMNVUL637YA
      const address = 'GAQNRDY5RPF4CZUQ4OUA7J2MSHQDE64H7WGWMS3HNZXVUL3LTYH5JAT2';
      await expect(sdk.getReverseDomain(address)).resolves.toBe('overcat.xlm');
    });

    test('subdomain', async () => {
      // SATCKCFVB4B26BRNY2ZRP5E65TM3LFLVV73PVCPCIC2CX6E52WC34ZPU
      const address = 'GCUISPFWWXCYBMH742BLJ6YK4SEOMLMCI2YEAWDOTK7SLZMABJ7RYBXQ';
      await expect(sdk.getReverseDomain(address)).resolves.toBe('hello.overcat.xlm');
    });

    test('not found', async () => {
      const address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      await expect(sdk.getReverseDomain(address)).rejects.toThrow(ReverseDomain404Error);
    });
  });

  describe('setReverseDomain', () => {
    test('domain', async () => {
      // SDNNCETFWJ3AGIR5MX6DVOIQVJK3OHHTGI2OOPTT7EEW2CMNVUL637YA
      const address = 'GAQNRDY5RPF4CZUQ4OUA7J2MSHQDE64H7WGWMS3HNZXVUL3LTYH5JAT2';
      const domain = 'overcat.xlm';
      const { sim } = await sdk.setReverseDomain({ address, domain, source: address });
      if (!sim) {
        throw new Error('Simulation failed: sim is null');
      }
      if (!sim.result) {
        throw new Error('Simulation failed: sim.result is null');
      }
      expect(sim).not.toBeNull();
      expect(sim.result).not.toBeNull();
      const retval = sim.result.retval;
      expect(retval).toStrictEqual(SDK.xdr.ScVal.scvVoid());
    });

    test('subdomain', async () => {
      // SATCKCFVB4B26BRNY2ZRP5E65TM3LFLVV73PVCPCIC2CX6E52WC34ZPU
      const address = 'GCUISPFWWXCYBMH742BLJ6YK4SEOMLMCI2YEAWDOTK7SLZMABJ7RYBXQ';
      const domain = 'hello.overcat.xlm';
      const { sim } = await sdk.setReverseDomain({ address, domain, source: address });
      if (!sim) {
        throw new Error('Simulation failed: sim is null');
      }
      if (!sim.result) {
        throw new Error('Simulation failed: sim.result is null');
      }
      expect(sim).not.toBeNull();
      expect(sim.result).not.toBeNull();
      const retval = sim.result.retval;
      expect(retval).toStrictEqual(SDK.xdr.ScVal.scvVoid());
    });

    test('none', async () => {
      // SDNNCETFWJ3AGIR5MX6DVOIQVJK3OHHTGI2OOPTT7EEW2CMNVUL637YA
      const address = 'GAQNRDY5RPF4CZUQ4OUA7J2MSHQDE64H7WGWMS3HNZXVUL3LTYH5JAT2';
      const { sim } = await sdk.setReverseDomain({ address, domain: null, source: address });
      if (!sim) {
        throw new Error('Simulation failed: sim is null');
      }
      if (!sim.result) {
        throw new Error('Simulation failed: sim.result is null');
      }
      expect(sim).not.toBeNull();
      expect(sim.result).not.toBeNull();
      const retval = sim.result.retval;
      expect(retval).toStrictEqual(SDK.xdr.ScVal.scvVoid());
    });
  });
});
