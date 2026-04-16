import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startMockWhmcs, type MockWhmcsServer } from '../mock-whmcs';

let server: MockWhmcsServer;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetStats: { result: 'success', stats: { income_today: '0.00' } },
    },
  });
});

afterAll(async () => {
  await server.stop();
});

describe('mock-whmcs', () => {
  it('returns a fixture for the requested action', async () => {
    const body = new URLSearchParams({
      action: 'GetStats',
      identifier: 'test-id',
      secret: 'test-secret',
      responsetype: 'json',
    });
    const res = await fetch(`${server.url}/includes/api.php`, {
      method: 'POST',
      body,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBe('success');
    expect(json.stats.income_today).toBe('0.00');
  });

  it('returns 404-shaped error for unknown action', async () => {
    const body = new URLSearchParams({
      action: 'DoesNotExist',
      identifier: 'test-id',
      secret: 'test-secret',
      responsetype: 'json',
    });
    const res = await fetch(`${server.url}/includes/api.php`, {
      method: 'POST',
      body,
    });
    const json = await res.json();
    expect(json.result).toBe('error');
    expect(json.message).toMatch(/unknown action/i);
  });

  it('records the last request for assertions', async () => {
    const body = new URLSearchParams({
      action: 'GetStats',
      identifier: 'test-id',
      secret: 'test-secret',
      responsetype: 'json',
      extra: 'value',
    });
    await fetch(`${server.url}/includes/api.php`, { method: 'POST', body });
    const last = server.lastRequest();
    expect(last?.params.get('action')).toBe('GetStats');
    expect(last?.params.get('extra')).toBe('value');
  });
});
