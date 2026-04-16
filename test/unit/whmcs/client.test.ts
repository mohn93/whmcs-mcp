import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../src/whmcs/client';
import { startMockWhmcs, type MockWhmcsServer } from '../../mock-whmcs';

let server: MockWhmcsServer;
let client: WhmcsClient;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetStats: { result: 'success', stats: { income_today: '1.23' } },
      Fails: { result: 'error', message: 'nope' },
    },
  });
  client = new WhmcsClient({
    apiUrl: server.url + '/',
    identifier: 'id',
    secret: 'sec',
  });
});

afterAll(async () => {
  await server.stop();
});

describe('WhmcsClient', () => {
  it('calls an action and returns the parsed body', async () => {
    const res = await client.call<{ stats: { income_today: string } }>('GetStats');
    expect(res.stats.income_today).toBe('1.23');
  });

  it('sends auth params on every call', async () => {
    await client.call('GetStats');
    const last = server.lastRequest();
    expect(last?.params.get('identifier')).toBe('id');
    expect(last?.params.get('secret')).toBe('sec');
    expect(last?.params.get('responsetype')).toBe('json');
  });

  it('throws with the WHMCS error message on result=error', async () => {
    await expect(client.call('Fails')).rejects.toThrow(/nope/);
  });

  it('includes optional access key when configured', async () => {
    const c2 = new WhmcsClient({
      apiUrl: server.url + '/',
      identifier: 'id',
      secret: 'sec',
      accesskey: 'KEY',
    });
    await c2.call('GetStats');
    expect(server.lastRequest()?.params.get('accesskey')).toBe('KEY');
  });
});
