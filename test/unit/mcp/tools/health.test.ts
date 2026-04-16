import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { HealthDomain } from '../../../../src/whmcs/domains/health';
import { registerHealthTools, type HealthToolDeps } from '../../../../src/mcp/tools/health';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import type { Capabilities } from '../../../../src/whmcs/version';

import statsFixture from '../../../fixtures/GetStats-health.json';
import serversFixture from '../../../fixtures/GetServers-with-usage.json';
import moduleQueueFixture from '../../../fixtures/ModuleQueue.json';
import invoicesFixture from '../../../fixtures/GetInvoices-overdue.json';
import productsFixture from '../../../fixtures/GetClientsProducts-stale.json';

let whmcsServer: MockWhmcsServer;
let health: HealthDomain;

type Handler = (...args: any[]) => Promise<any>;
let registrations: Record<string, Handler>;
let mockMcpServer: { registerTool: ReturnType<typeof vi.fn> };

beforeAll(async () => {
  whmcsServer = await startMockWhmcs({
    fixtures: {
      GetStats: statsFixture,
      GetServers: serversFixture,
      ModuleQueue: moduleQueueFixture,
      GetInvoices: invoicesFixture,
      GetClientsProducts: productsFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: whmcsServer.url + '/', identifier: 'id', secret: 'sec' });
  health = new HealthDomain(client);
});
afterAll(async () => { await whmcsServer.stop(); });

beforeEach(() => {
  registrations = {};
  mockMcpServer = {
    registerTool: vi.fn((name: string, _opts: unknown, handler: Handler) => {
      registrations[name] = handler;
    }),
  };
});

function register(caps: Partial<Capabilities> = {}): void {
  const fullCaps: Capabilities = {
    version: '8.5.0',
    major: 8,
    minor: 5,
    hasModuleQueue: true,
    hasCreateSsoToken: true,
    hasGetCredits: true,
    ...caps,
  };
  registerHealthTools(mockMcpServer as never, { health, capabilities: fullCaps });
}

describe('registerHealthTools', () => {
  it('registers 2 health tools', () => {
    register();
    const names = mockMcpServer.registerTool.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual([
      'whmcs_get_health_summary',
      'whmcs_find_inconsistencies',
    ]);
  });

  it('whmcs_get_health_summary returns structured data', async () => {
    register();
    const handler = registrations['whmcs_get_health_summary'];
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.stats.income_today).toBe('1250.00');
    expect(parsed.stats.orders_pending).toBe(3);
    expect(parsed.servers.total).toBe(2);
    expect(parsed.servers.hotCount).toBe(1);
    expect(parsed.servers.hotServers).toEqual(['node-02']);
    expect(parsed.moduleQueue.supported).toBe(true);
    expect(parsed.moduleQueue.pendingCount).toBe(1);
  });

  it('whmcs_find_inconsistencies returns structured data', async () => {
    register();
    const handler = registrations['whmcs_find_inconsistencies'];
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.overdueInvoices).toHaveLength(1);
    expect(parsed.overdueInvoices[0].id).toBe(6001);
    expect(parsed.staleServices).toHaveLength(1);
    expect(parsed.staleServices[0].id).toBe(3001);
  });

  it('whmcs_get_health_summary handles unsupported ModuleQueue gracefully', async () => {
    register({ hasModuleQueue: false });
    const handler = registrations['whmcs_get_health_summary'];
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.moduleQueue.supported).toBe(false);
    expect(parsed.moduleQueue.reason).toMatch(/WHMCS.*8/);
    // Stats should still be returned
    expect(parsed.stats.income_today).toBe('1250.00');
  });
});
