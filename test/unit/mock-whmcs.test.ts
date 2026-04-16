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

  it('setFixture overrides previously set fixture', async () => {
    // First verify the original fixture
    let body = new URLSearchParams({ action: 'GetStats', identifier: 'test-id', secret: 'test-secret', responsetype: 'json' });
    let res = await fetch(`${server.url}/includes/api.php`, { method: 'POST', body });
    let json = await res.json();
    expect(json.stats.income_today).toBe('0.00');

    // Override the fixture
    server.setFixture('GetStats', { result: 'success', stats: { income_today: '999.99' } });

    body = new URLSearchParams({ action: 'GetStats', identifier: 'test-id', secret: 'test-secret', responsetype: 'json' });
    res = await fetch(`${server.url}/includes/api.php`, { method: 'POST', body });
    json = await res.json();
    expect(json.stats.income_today).toBe('999.99');

    // Restore
    server.setFixture('GetStats', { result: 'success', stats: { income_today: '0.00' } });
  });

  it('can add a new fixture via setFixture', async () => {
    server.setFixture('NewAction', { result: 'success', data: 'hello' });
    const body = new URLSearchParams({ action: 'NewAction', identifier: 'test-id', secret: 'test-secret', responsetype: 'json' });
    const res = await fetch(`${server.url}/includes/api.php`, { method: 'POST', body });
    const json = await res.json();
    expect(json.result).toBe('success');
    expect(json.data).toBe('hello');
  });

  it('multiple sequential requests do not interfere with each other', async () => {
    server.setFixture('ActionA', { result: 'success', value: 'A' });
    server.setFixture('ActionB', { result: 'success', value: 'B' });

    const bodyA = new URLSearchParams({ action: 'ActionA', identifier: 'test-id', secret: 'test-secret', responsetype: 'json' });
    const resA = await fetch(`${server.url}/includes/api.php`, { method: 'POST', body: bodyA });
    const jsonA = await resA.json();

    const bodyB = new URLSearchParams({ action: 'ActionB', identifier: 'test-id', secret: 'test-secret', responsetype: 'json' });
    const resB = await fetch(`${server.url}/includes/api.php`, { method: 'POST', body: bodyB });
    const jsonB = await resB.json();

    expect(jsonA.value).toBe('A');
    expect(jsonB.value).toBe('B');
  });

  it('concurrent requests return correct fixtures', async () => {
    server.setFixture('ConcA', { result: 'success', val: 'concA' });
    server.setFixture('ConcB', { result: 'success', val: 'concB' });

    const [resA, resB] = await Promise.all([
      fetch(`${server.url}/includes/api.php`, {
        method: 'POST',
        body: new URLSearchParams({ action: 'ConcA', identifier: 'id', secret: 'sec', responsetype: 'json' }),
      }),
      fetch(`${server.url}/includes/api.php`, {
        method: 'POST',
        body: new URLSearchParams({ action: 'ConcB', identifier: 'id', secret: 'sec', responsetype: 'json' }),
      }),
    ]);

    const jsonA = await resA.json();
    const jsonB = await resB.json();
    expect(jsonA.val).toBe('concA');
    expect(jsonB.val).toBe('concB');
  });
});
