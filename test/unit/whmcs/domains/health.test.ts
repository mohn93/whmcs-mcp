import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { HealthDomain } from '../../../../src/whmcs/domains/health';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import statsFixture from '../../../fixtures/GetStats-health.json';
import serversFixture from '../../../fixtures/GetServers-with-usage.json';
import moduleQueueFixture from '../../../fixtures/ModuleQueue.json';
import invoicesFixture from '../../../fixtures/GetInvoices-overdue.json';
import productsFixture from '../../../fixtures/GetClientsProducts-stale.json';

let server: MockWhmcsServer;
let health: HealthDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetStats: statsFixture,
      GetServers: serversFixture,
      ModuleQueue: moduleQueueFixture,
      GetInvoices: invoicesFixture,
      GetClientsProducts: productsFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  health = new HealthDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('HealthDomain.getHealthSummary', () => {
  it('returns aggregated stats with hot server count', async () => {
    const summary = await health.getHealthSummary({ hasModuleQueue: true });

    expect(summary.stats.income_today).toBe('1250.00');
    expect(summary.stats.orders_pending).toBe(3);
    expect(summary.stats.invoices_overdue).toBe(12);
    expect(summary.stats.tickets_awaiting).toBe(7);

    expect(summary.servers.total).toBe(2);
    expect(summary.servers.hotCount).toBe(1);
    expect(summary.servers.hotServers).toEqual(['node-02']);

    expect(summary.moduleQueue).toEqual({ supported: true, pendingCount: 1 });
  });

  it('handles unsupported module queue', async () => {
    const summary = await health.getHealthSummary({ hasModuleQueue: false });

    expect(summary.moduleQueue).toEqual({
      supported: false,
      reason: 'ModuleQueue API action requires WHMCS 8.0 or later.',
    });

    // Stats and servers should still be returned
    expect(summary.stats.income_today).toBe('1250.00');
    expect(summary.servers.total).toBe(2);
  });
});

describe('HealthDomain.findInconsistencies', () => {
  it('returns overdue invoices > 90 days only', async () => {
    const result = await health.findInconsistencies();

    // Invoice 6001 (duedate 2024-10-01) should be > 90 days overdue
    // Invoice 6002 (duedate 2026-04-10) should NOT be > 90 days overdue
    expect(result.overdueInvoices).toHaveLength(1);
    expect(result.overdueInvoices[0].id).toBe(6001);
    expect(result.overdueInvoices[0].userid).toBe(42);
    expect(result.overdueInvoices[0].total).toBe('150.00');
    expect(result.overdueInvoices[0].daysOverdue).toBeGreaterThan(90);
  });

  it('returns stale pending services', async () => {
    const result = await health.findInconsistencies();

    // Product 3001 (regdate 2024-06-01) should be stale (> 7 days old, Pending)
    // Product 3002 (regdate 2026-04-14) should NOT be stale (recent)
    expect(result.staleServices).toHaveLength(1);
    expect(result.staleServices[0].id).toBe(3001);
    expect(result.staleServices[0].clientid).toBe(42);
    expect(result.staleServices[0].name).toBe('Business Hosting');
    expect(result.staleServices[0].status).toBe('Pending');
  });
});
