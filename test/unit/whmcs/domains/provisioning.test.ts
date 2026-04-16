import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ProvisioningDomain } from '../../../../src/whmcs/domains/provisioning';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import productFixture from '../../../fixtures/GetClientsProducts-service.json';
import byServerFixture from '../../../fixtures/GetClientsProducts-byserver.json';
import activityFixture from '../../../fixtures/GetActivityLog-service.json';
import moduleLogFixture from '../../../fixtures/GetModuleLog.json';
import moduleQueueFixture from '../../../fixtures/ModuleQueue.json';
import serversFixture from '../../../fixtures/GetServers-with-usage.json';
import moduleCustomFixture from '../../../fixtures/ModuleCustom-createAccount.json';

let server: MockWhmcsServer;
let prov: ProvisioningDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetClientsProducts: productFixture,
      GetActivityLog: activityFixture,
      ModuleQueue: moduleQueueFixture,
      GetServers: serversFixture,
      ModuleCustom: moduleCustomFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  prov = new ProvisioningDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('ProvisioningDomain.getServiceDetails', () => {
  it('returns enriched single-service record', async () => {
    const svc = await prov.getServiceDetails(1001);
    expect(svc.id).toBe(1001);
    expect(svc.status).toBe('Pending');
    expect(svc.domain).toBe('example.test');
    expect(svc.server?.name).toBe('node-01');
    expect(svc.nextduedate).toBe('2026-01-15');
  });

  it('sends serviceid filter to WHMCS', async () => {
    await prov.getServiceDetails(1001);
    expect(server.lastRequest()?.params.get('action')).toBe('GetClientsProducts');
    expect(server.lastRequest()?.params.get('serviceid')).toBe('1001');
  });

  it('throws a useful error when service is not found', async () => {
    server.setFixture('GetClientsProducts', {
      result: 'success', totalresults: 0, products: { product: [] },
    });
    await expect(prov.getServiceDetails(9999)).rejects.toThrow(/Service 9999 not found/);
    // Restore original fixture for other tests
    server.setFixture('GetClientsProducts', productFixture);
  });

  it('returns undefined server when serverid is 0 (no server assigned)', async () => {
    server.setFixture('GetClientsProducts', {
      result: 'success',
      totalresults: 1,
      products: {
        product: [{
          id: 1001, clientid: 42, orderid: 2001, pid: 5,
          name: 'Starter Hosting', groupname: 'Web Hosting',
          domain: 'example.test', status: 'Pending',
          regdate: '2025-01-15', nextduedate: '2026-01-15',
          billingcycle: 'Monthly', recurringamount: '10.00',
          paymentmethod: 'stripe', username: 'expl1234',
          serverid: 0, servername: '', serverhostname: '', serverip: '',
        }],
      },
    });
    const svc = await prov.getServiceDetails(1001);
    expect(svc.server).toBeUndefined();
    // Restore
    server.setFixture('GetClientsProducts', productFixture);
  });
});

describe('ProvisioningDomain.getModuleLog', () => {
  it('returns only activity-log entries related to the given service ID', async () => {
    const log = await prov.getModuleLog(1001);
    expect(log).toHaveLength(2);
    expect(log[0].description).toMatch(/Module Create Failed/);
    expect(log[1].description).toMatch(/Module Create Command Initiated/);
    expect(log.every((e) => /1001/.test(e.description))).toBe(true);
  });

  it('passes a narrowing description filter to the WHMCS API', async () => {
    await prov.getModuleLog(1001);
    expect(server.lastRequest()?.params.get('action')).toBe('GetActivityLog');
    expect(server.lastRequest()?.params.get('description')).toContain('1001');
  });

  it('honors the limit parameter', async () => {
    await prov.getModuleLog(1001, { limit: 5 });
    expect(server.lastRequest()?.params.get('limitnum')).toBe('5');
  });

  it('returns empty array when activity log has no entries', async () => {
    server.setFixture('GetActivityLog', {
      result: 'success', totalresults: 0, activity: { entry: [] },
    });
    const log = await prov.getModuleLog(1001);
    expect(log).toHaveLength(0);
    expect(log).toEqual([]);
    // Restore
    server.setFixture('GetActivityLog', activityFixture);
  });
});

describe('ProvisioningDomain.getModuleQueue', () => {
  it('returns entries when capability is present', async () => {
    const caps = { hasModuleQueue: true } as const;
    const q = await prov.getModuleQueue(caps);
    expect(q.supported).toBe(true);
    if (q.supported) {
      expect(q.items).toHaveLength(1);
      expect(q.items[0].service_id).toBe(1001);
      expect(q.items[0].last_attempt_error).toMatch(/domain already exists/);
    }
  });

  it('reports unsupported when capability is missing', async () => {
    const caps = { hasModuleQueue: false } as const;
    const q = await prov.getModuleQueue(caps);
    expect(q.supported).toBe(false);
    if (!q.supported) {
      expect(q.reason).toMatch(/WHMCS.*8/);
    }
  });

  it('returns empty items when module queue is supported but empty', async () => {
    server.setFixture('ModuleQueue', {
      result: 'success', totalresults: 0, queue: { item: [] },
    });
    const caps = { hasModuleQueue: true } as const;
    const q = await prov.getModuleQueue(caps);
    expect(q.supported).toBe(true);
    if (q.supported) {
      expect(q.items).toHaveLength(0);
      expect(q.items).toEqual([]);
    }
    // Restore
    server.setFixture('ModuleQueue', moduleQueueFixture);
  });
});

describe('ProvisioningDomain.getServerUsage', () => {
  it('returns per-server utilization including headroom', async () => {
    const u = await prov.getServerUsage();
    expect(u).toHaveLength(2);
    const node01 = u.find((s) => s.name === 'node-01')!;
    expect(node01.used).toBe(85);
    expect(node01.capacity).toBe(200);
    expect(node01.percentUsed).toBe(42);
    expect(node01.headroom).toBe(115);
    expect(node01.module).toBe('cpanel');
  });

  it('flags servers over 90% utilization', async () => {
    const u = await prov.getServerUsage();
    const hot = u.filter((s) => s.percentUsed >= 90);
    expect(hot).toHaveLength(1);
    expect(hot[0].name).toBe('node-02');
  });

  it('returns empty array when no servers exist', async () => {
    server.setFixture('GetServers', { result: 'success', servers: [] });
    const u = await prov.getServerUsage();
    expect(u).toHaveLength(0);
    expect(u).toEqual([]);
    // Restore
    server.setFixture('GetServers', serversFixture);
  });
});

describe('ProvisioningDomain.resyncService', () => {
  it('issues a ModuleCreate call for the given service', async () => {
    const r = await prov.resyncService(1001, 'Create');
    expect(r.message).toMatch(/successfully/i);
    const last = server.lastRequest()!;
    expect(last.params.get('action')).toBe('ModuleCustom');
    expect(last.params.get('serviceid')).toBe('1001');
    expect(last.params.get('func_name')).toBe('Create');
  });

  it('defaults to Create when no action is provided', async () => {
    await prov.resyncService(1001);
    expect(server.lastRequest()!.params.get('func_name')).toBe('Create');
  });

  it('rejects unsupported actions', async () => {
    await expect(prov.resyncService(1001, 'DropTables' as never)).rejects.toThrow(/unsupported/i);
  });

  it('issues a Suspend call when action is Suspend', async () => {
    const r = await prov.resyncService(1001, 'Suspend');
    expect(r.message).toMatch(/successfully/i);
    const last = server.lastRequest()!;
    expect(last.params.get('func_name')).toBe('Suspend');
    expect(last.params.get('serviceid')).toBe('1001');
  });

  it('issues an Unsuspend call when action is Unsuspend', async () => {
    const r = await prov.resyncService(1001, 'Unsuspend');
    expect(r.message).toMatch(/successfully/i);
    expect(server.lastRequest()!.params.get('func_name')).toBe('Unsuspend');
  });

  it('issues a Terminate call when action is Terminate', async () => {
    const r = await prov.resyncService(1001, 'Terminate');
    expect(r.message).toMatch(/successfully/i);
    expect(server.lastRequest()!.params.get('func_name')).toBe('Terminate');
  });
});

describe('ProvisioningDomain.getServicesByServer', () => {
  it('returns services filtered by server (client-side)', async () => {
    server.setFixture('GetClientsProducts', byServerFixture);
    const result = await prov.getServicesByServer(3);
    expect(result.services).toHaveLength(2);
    expect(result.services[0].id).toBe(1001);
    expect(result.services[0].domain).toBe('example.test');
    expect(result.services[0].status).toBe('Active');
    expect(result.services[1].id).toBe(1003);
    expect(result.services[1].status).toBe('Suspended');
    expect(result.totalScanned).toBe(2);
    expect(result.statusCounts).toEqual({ Active: 1, Suspended: 1 });
    // Restore
    server.setFixture('GetClientsProducts', productFixture);
  });

  it('paginates without serverid param (WHMCS ignores it)', async () => {
    server.setFixture('GetClientsProducts', byServerFixture);
    await prov.getServicesByServer(3);
    expect(server.lastRequest()?.params.get('action')).toBe('GetClientsProducts');
    // No serverid sent — we filter client-side
    expect(server.lastRequest()?.params.has('serverid')).toBe(false);
    // Restore
    server.setFixture('GetClientsProducts', productFixture);
  });

  it('returns empty when no services match the server', async () => {
    server.setFixture('GetClientsProducts', {
      result: 'success', totalresults: 0, products: { product: [] },
    });
    const result = await prov.getServicesByServer(999);
    expect(result.services).toHaveLength(0);
    expect(result.totalScanned).toBe(0);
    // Restore
    server.setFixture('GetClientsProducts', productFixture);
  });
});

describe('ProvisioningDomain.getModuleDebugLog', () => {
  it('returns module_log source when GetModuleLog succeeds', async () => {
    server.setFixture('GetModuleLog', moduleLogFixture);
    const result = await prov.getModuleDebugLog({ module: 'cpanel' });
    expect(result.source).toBe('module_log');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].action).toBe('CreateAccount');
    expect(result.entries[0].request).toContain('createacct');
    expect(result.entries[0].response).toContain('domain already exists');
  });

  it('falls back to activity_log source when GetModuleLog fails', async () => {
    // Do NOT set a GetModuleLog fixture — mock returns error for unknown actions
    server.setFixture('GetModuleLog', undefined as any);
    // Remove the fixture so it falls back
    const fixtures = (server as any);
    // The mock returns an error for unknown actions, which client.call throws on
    // We need to ensure GetModuleLog is NOT registered
    server.setFixture('GetActivityLog', activityFixture);
    const result = await prov.getModuleDebugLog({ serviceId: 1001 });
    expect(result.source).toBe('activity_log');
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.every((e) => /module/i.test(e.description ?? ''))).toBe(true);
    // Restore
    server.setFixture('GetActivityLog', activityFixture);
  });

  it('filters activity entries to module-related ones', async () => {
    // Remove GetModuleLog fixture to trigger fallback
    server.setFixture('GetModuleLog', undefined as any);
    server.setFixture('GetActivityLog', activityFixture);
    const result = await prov.getModuleDebugLog({ serviceId: 1001 });
    expect(result.source).toBe('activity_log');
    // The activity fixture has 3 entries, but only 2 contain "Module"
    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((e) => /module/i.test(e.description ?? ''))).toBe(true);
    // Restore
    server.setFixture('GetActivityLog', activityFixture);
  });
});

describe('ProvisioningDomain.getServerModules', () => {
  it('groups servers by module name', async () => {
    server.setFixture('GetServers', {
      result: 'success',
      servers: [
        { id: 3, name: 'node-01', hostname: 'node-01.local', module: 'cpanel', activestatus: true, noofservices: 85, maxallowedservices: 200, percentused: 42 },
        { id: 4, name: 'node-02', hostname: 'node-02.local', module: 'cpanel', activestatus: true, noofservices: 195, maxallowedservices: 200, percentused: 97 },
        { id: 5, name: 'plesk-01', hostname: 'plesk-01.local', module: 'plesk', activestatus: true, noofservices: 50, maxallowedservices: 100, percentused: 50 },
      ],
    });
    const modules = await prov.getServerModules();
    expect(modules).toHaveLength(2);
    const cpanel = modules.find((m) => m.module === 'cpanel')!;
    expect(cpanel).toBeDefined();
    expect(cpanel.servers).toHaveLength(2);
    const plesk = modules.find((m) => m.module === 'plesk')!;
    expect(plesk).toBeDefined();
    expect(plesk.servers).toHaveLength(1);
    // Restore
    server.setFixture('GetServers', serversFixture);
  });

  it('calculates totals correctly', async () => {
    server.setFixture('GetServers', {
      result: 'success',
      servers: [
        { id: 3, name: 'node-01', hostname: 'node-01.local', module: 'cpanel', activestatus: true, noofservices: 85, maxallowedservices: 200, percentused: 42 },
        { id: 4, name: 'node-02', hostname: 'node-02.local', module: 'cpanel', activestatus: true, noofservices: 195, maxallowedservices: 200, percentused: 97 },
      ],
    });
    const modules = await prov.getServerModules();
    const cpanel = modules.find((m) => m.module === 'cpanel')!;
    expect(cpanel.totalServers).toBe(2);
    expect(cpanel.totalCapacity).toBe(400);
    expect(cpanel.totalUsed).toBe(280);
    // Restore
    server.setFixture('GetServers', serversFixture);
  });

  it('returns empty array when no servers exist', async () => {
    server.setFixture('GetServers', { result: 'success', servers: [] });
    const modules = await prov.getServerModules();
    expect(modules).toHaveLength(0);
    expect(modules).toEqual([]);
    // Restore
    server.setFixture('GetServers', serversFixture);
  });
});
