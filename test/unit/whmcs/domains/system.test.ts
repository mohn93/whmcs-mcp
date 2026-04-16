import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { SystemDomain } from '../../../../src/whmcs/domains/system';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import fixture from '../../../fixtures/GetStats.json';

let server: MockWhmcsServer;
let system: SystemDomain;

beforeAll(async () => {
  server = await startMockWhmcs({ fixtures: { GetStats: fixture } });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  system = new SystemDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('SystemDomain.getStats', () => {
  it('returns typed stats', async () => {
    const stats = await system.getStats();
    expect(stats.income_today).toBe('0.00');
    expect(stats.orders_pending_count).toBe(0);
  });

  it('returns all expected fields', async () => {
    const stats = await system.getStats();
    expect(stats).toHaveProperty('income_today');
    expect(stats).toHaveProperty('income_thismonth');
    expect(stats).toHaveProperty('income_thisyear');
    expect(stats).toHaveProperty('income_alltime');
    expect(stats).toHaveProperty('orders_pending_count');
    expect(stats).toHaveProperty('tickets_awaitingreply_count');
    expect(stats).toHaveProperty('invoices_unpaid_count');
  });

  it('calls GetStats action on WHMCS API', async () => {
    await system.getStats();
    expect(server.lastRequest()?.params.get('action')).toBe('GetStats');
  });
});
