import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ProvisioningDomain } from '../../../../src/whmcs/domains/provisioning';
import { registerProvisioningTools, type ProvisioningToolDeps } from '../../../../src/mcp/tools/provisioning';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import type { Capabilities } from '../../../../src/whmcs/version';

import productFixture from '../../../fixtures/GetClientsProducts-service.json';
import byServerFixture from '../../../fixtures/GetClientsProducts-byserver.json';
import activityFixture from '../../../fixtures/GetActivityLog-service.json';
import moduleLogFixture from '../../../fixtures/GetModuleLog.json';
import moduleQueueFixture from '../../../fixtures/ModuleQueue.json';
import serversFixture from '../../../fixtures/GetServers-with-usage.json';
import moduleCustomFixture from '../../../fixtures/ModuleCustom-createAccount.json';

let whmcsServer: MockWhmcsServer;
let prov: ProvisioningDomain;

// Capture registerTool calls
type Handler = (...args: any[]) => Promise<any>;
let registrations: Record<string, Handler>;
let mockMcpServer: { registerTool: ReturnType<typeof vi.fn> };

const ORIGINAL_MUTATIONS = process.env.WHMCS_ALLOW_MUTATIONS;

beforeAll(async () => {
  whmcsServer = await startMockWhmcs({
    fixtures: {
      GetClientsProducts: productFixture,
      GetActivityLog: activityFixture,
      ModuleQueue: moduleQueueFixture,
      GetServers: serversFixture,
      ModuleCustom: moduleCustomFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: whmcsServer.url + '/', identifier: 'id', secret: 'sec' });
  prov = new ProvisioningDomain(client);
});
afterAll(async () => { await whmcsServer.stop(); });

beforeEach(() => {
  delete process.env.WHMCS_ALLOW_MUTATIONS;

  registrations = {};
  mockMcpServer = {
    registerTool: vi.fn((name: string, _opts: unknown, handler: Handler) => {
      registrations[name] = handler;
    }),
  };
});

afterEach(() => {
  if (ORIGINAL_MUTATIONS === undefined) delete process.env.WHMCS_ALLOW_MUTATIONS;
  else process.env.WHMCS_ALLOW_MUTATIONS = ORIGINAL_MUTATIONS;
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
  registerProvisioningTools(mockMcpServer as never, { provisioning: prov, capabilities: fullCaps });
}

describe('registerProvisioningTools', () => {
  it('registers all 8 provisioning tools', () => {
    register();
    const names = mockMcpServer.registerTool.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual([
      'whmcs_get_service_details',
      'whmcs_get_module_log',
      'whmcs_get_module_queue',
      'whmcs_get_server_usage',
      'whmcs_get_services_by_server',
      'whmcs_get_module_debug_log',
      'whmcs_get_server_modules',
      'whmcs_resync_service',
    ]);
  });

  it('whmcs_get_service_details returns JSON with service data', async () => {
    register();
    const handler = registrations['whmcs_get_service_details'];
    const result = await handler({ serviceId: 1001 });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe(1001);
    expect(parsed.domain).toBe('example.test');
    expect(parsed.status).toBe('Pending');
    expect(parsed.server?.name).toBe('node-01');
  });

  it('whmcs_resync_service is BLOCKED when WHMCS_ALLOW_MUTATIONS is unset', async () => {
    delete process.env.WHMCS_ALLOW_MUTATIONS;
    register();
    const handler = registrations['whmcs_resync_service'];
    const result = await handler({ serviceId: 1001, confirm: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/WHMCS_ALLOW_MUTATIONS/);
  });

  it('whmcs_resync_service is BLOCKED when confirm is not true', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    register();
    const handler = registrations['whmcs_resync_service'];
    const result = await handler({ serviceId: 1001 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/confirm: true/);
  });

  it('whmcs_resync_service WORKS when both env flag set AND confirm=true', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    register();
    const handler = registrations['whmcs_resync_service'];
    const result = await handler({ serviceId: 1001, action: 'Create', confirm: true });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toMatch(/successfully/i);
  });

  it('whmcs_get_module_queue surfaces unsupported state gracefully', async () => {
    register({ hasModuleQueue: false });
    const handler = registrations['whmcs_get_module_queue'];
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.supported).toBe(false);
    expect(parsed.reason).toMatch(/WHMCS.*8/);
  });

  it('whmcs_get_module_log returns activity entries', async () => {
    register();
    const handler = registrations['whmcs_get_module_log'];
    const result = await handler({ serviceId: 1001 });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].description).toMatch(/Module Create/);
  });

  it('whmcs_get_module_queue returns entries when supported', async () => {
    register({ hasModuleQueue: true });
    const handler = registrations['whmcs_get_module_queue'];
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.supported).toBe(true);
    expect(parsed.items).toHaveLength(1);
  });

  it('whmcs_get_server_usage returns server utilization data', async () => {
    register();
    const handler = registrations['whmcs_get_server_usage'];
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('node-01');
    expect(parsed[1].percentUsed).toBe(97);
  });

  it('whmcs_get_services_by_server returns services for a server', async () => {
    whmcsServer.setFixture('GetClientsProducts', byServerFixture);
    register();
    const handler = registrations['whmcs_get_services_by_server'];
    const result = await handler({ serverId: 3 });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.services).toHaveLength(2);
    expect(parsed.services[0].domain).toBe('example.test');
    expect(parsed.services[1].status).toBe('Suspended');
    expect(parsed.statusCounts).toBeDefined();
    // Restore
    whmcsServer.setFixture('GetClientsProducts', productFixture);
  });

  it('whmcs_get_module_debug_log returns module log when available', async () => {
    whmcsServer.setFixture('GetModuleLog', moduleLogFixture);
    register();
    const handler = registrations['whmcs_get_module_debug_log'];
    const result = await handler({ module: 'cpanel' });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.source).toBe('module_log');
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].action).toBe('CreateAccount');
  });

  it('whmcs_get_module_debug_log falls back to activity log', async () => {
    // Remove GetModuleLog fixture to trigger fallback
    whmcsServer.setFixture('GetModuleLog', undefined as any);
    whmcsServer.setFixture('GetActivityLog', activityFixture);
    register();
    const handler = registrations['whmcs_get_module_debug_log'];
    const result = await handler({ serviceId: 1001 });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.source).toBe('activity_log');
    expect(parsed.entries.length).toBeGreaterThan(0);
    // Restore
    whmcsServer.setFixture('GetActivityLog', activityFixture);
  });

  it('whmcs_get_server_modules returns module-grouped server data', async () => {
    whmcsServer.setFixture('GetServers', {
      result: 'success',
      servers: [
        { id: 3, name: 'node-01', hostname: 'node-01.local', module: 'cpanel', activestatus: true, noofservices: 85, maxallowedservices: 200, percentused: 42 },
        { id: 5, name: 'plesk-01', hostname: 'plesk-01.local', module: 'plesk', activestatus: true, noofservices: 50, maxallowedservices: 100, percentused: 50 },
      ],
    });
    register();
    const handler = registrations['whmcs_get_server_modules'];
    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    const cpanel = parsed.find((m: any) => m.module === 'cpanel');
    expect(cpanel).toBeDefined();
    expect(cpanel.totalServers).toBe(1);
    expect(cpanel.totalCapacity).toBe(200);
    // Restore
    whmcsServer.setFixture('GetServers', serversFixture);
  });
});
