import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ProvisioningDomain } from '../../../../src/whmcs/domains/provisioning';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import productFixture from '../../../fixtures/GetClientsProducts-service.json';
import activityFixture from '../../../fixtures/GetActivityLog-service.json';
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
