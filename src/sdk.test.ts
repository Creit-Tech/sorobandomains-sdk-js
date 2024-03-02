import { SorobanDomainsSDK } from './sdk';

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
