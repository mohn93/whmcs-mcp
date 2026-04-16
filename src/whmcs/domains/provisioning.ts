import type { WhmcsClient } from '../client.js';

export interface ServiceDetails {
  id: number;
  clientid: number;
  orderid: number;
  pid: number;
  name: string;
  groupname: string;
  domain: string;
  status: string;
  regdate: string;
  nextduedate: string;
  billingcycle: string;
  recurringamount: string;
  paymentmethod: string;
  server?: {
    id: number;
    name: string;
    hostname: string;
    ip: string;
  };
  username: string;
}

interface RawProduct {
  id: number; clientid: number; orderid: number; pid: number;
  name: string; groupname: string; domain: string; status: string;
  regdate: string; nextduedate: string; billingcycle: string;
  recurringamount: string; paymentmethod: string;
  serverid: number; servername: string; serverhostname: string; serverip: string;
  username: string;
}

type ModuleAction = 'Create' | 'Suspend' | 'Unsuspend' | 'Terminate' | 'ChangePackage' | 'ChangePassword';

export class ProvisioningDomain {
  private static readonly SUPPORTED_ACTIONS: ReadonlySet<string> = new Set([
    'Create', 'Suspend', 'Unsuspend', 'Terminate', 'ChangePackage', 'ChangePassword',
  ]);

  constructor(private client: WhmcsClient) {}

  async getModuleLog(
    serviceId: number,
    options: { limit?: number } = {},
  ): Promise<Array<{ date: string; user: string; userid: number; description: string }>> {
    const res = await this.client.call<{
      activity: { entry: Array<{ date: string; user: string; userid: number; description: string }> };
    }>('GetActivityLog', {
      description: `Service ID ${serviceId}`,
      limitnum: options.limit ?? 50,
    });
    const entries = res.activity?.entry ?? [];
    return entries.filter(
      (e) =>
        new RegExp(
          `\\b(Service ID ${serviceId}|Service #${serviceId}|service ${serviceId})\\b`,
          'i',
        ).test(e.description) || /Module /i.test(e.description),
    );
  }

  async getModuleQueue(caps: { hasModuleQueue: boolean }): Promise<
    | { supported: true; items: Array<{
        id: number; service_type: string; service_id: number;
        module: string; action: string; related_id: number;
        last_attempt: string; last_attempt_error: string;
      }> }
    | { supported: false; reason: string }
  > {
    if (!caps.hasModuleQueue) {
      return {
        supported: false,
        reason: 'ModuleQueue API action requires WHMCS 8.0 or later.',
      };
    }
    const res = await this.client.call<{
      queue: { item: Array<{
        id: number; service_type: string; service_id: number;
        module: string; action: string; related_id: number;
        last_attempt: string; last_attempt_error: string;
      }> };
    }>('ModuleQueue');
    return { supported: true, items: res.queue?.item ?? [] };
  }

  async getServiceDetails(serviceId: number): Promise<ServiceDetails> {
    const res = await this.client.call<{
      totalresults: number;
      products: { product: RawProduct[] };
    }>('GetClientsProducts', { serviceid: serviceId });

    const product = res.products?.product?.[0];
    if (!product) {
      throw new Error(`Service ${serviceId} not found`);
    }
    return {
      id: product.id,
      clientid: product.clientid,
      orderid: product.orderid,
      pid: product.pid,
      name: product.name,
      groupname: product.groupname,
      domain: product.domain,
      status: product.status,
      regdate: product.regdate,
      nextduedate: product.nextduedate,
      billingcycle: product.billingcycle,
      recurringamount: product.recurringamount,
      paymentmethod: product.paymentmethod,
      username: product.username,
      server: product.serverid
        ? {
            id: product.serverid,
            name: product.servername,
            hostname: product.serverhostname,
            ip: product.serverip,
          }
        : undefined,
    };
  }

  async getServerUsage(): Promise<
    Array<{
      id: number; name: string; hostname: string; ip: string;
      module: string; active: boolean;
      used: number; capacity: number; percentUsed: number; headroom: number;
    }>
  > {
    const res = await this.client.call<{
      servers: Array<{
        id: number; name: string; hostname: string; ipaddress: string;
        noofservices: number; maxallowedservices: number; percentused: number;
        activestatus: boolean; module: string;
      }>;
    }>('GetServers');

    return (res.servers ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      hostname: s.hostname,
      ip: s.ipaddress,
      module: s.module,
      active: s.activestatus,
      used: s.noofservices,
      capacity: s.maxallowedservices,
      percentUsed: s.percentused,
      headroom: Math.max(0, s.maxallowedservices - s.noofservices),
    }));
  }

  async getServicesByServer(serverId: number): Promise<Array<{
    id: number; clientid: number; name: string; domain: string;
    status: string; regdate: string; nextduedate: string;
  }>> {
    // Paginate to avoid WHMCS PHP memory exhaustion on large databases
    const PAGE_SIZE = 100;
    const MAX_PAGES = 10; // safety cap: 1000 services max
    const allServices: Array<{
      id: number; clientid: number; name: string; domain: string;
      status: string; regdate: string; nextduedate: string;
    }> = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const res = await this.client.call<{
          totalresults: number;
          products: { product: Array<{
            id: number; clientid: number; name: string; domain: string;
            status: string; regdate: string; nextduedate: string;
            serverid: number;
          }> };
        }>('GetClientsProducts', {
          serverid: serverId,
          limitstart: page * PAGE_SIZE,
          limitnum: PAGE_SIZE,
        });

        const products = res.products?.product ?? [];
        for (const p of products) {
          allServices.push({
            id: p.id, clientid: p.clientid, name: p.name, domain: p.domain,
            status: p.status, regdate: p.regdate, nextduedate: p.nextduedate,
          });
        }

        // Stop if we got fewer than a full page (no more results)
        if (products.length < PAGE_SIZE) break;
      } catch (err) {
        // If even paginated requests fail, return what we have so far with an indicator
        if (allServices.length > 0) break;
        throw new Error(
          `Failed to fetch services for server ${serverId}: ${(err as Error).message}. ` +
          `This may be caused by WHMCS PHP memory limits — ask your sysadmin to increase memory_limit in php.ini.`
        );
      }
    }

    return allServices;
  }

  async getModuleDebugLog(options: {
    serviceId?: number;
    module?: string;
    limit?: number;
  } = {}): Promise<{
    source: 'module_log' | 'activity_log';
    entries: Array<{ date: string; action: string; request?: string; response?: string; description?: string }>;
  }> {
    // Try GetModuleLog first (WHMCS 8.x)
    try {
      const res = await this.client.call<{
        logs: { log: Array<{
          date: string; action: string; request: string; response: string;
        }> };
      }>('GetModuleLog', {
        ...(options.module ? { module: options.module } : {}),
        limitnum: options.limit ?? 50,
      });
      const entries = res.logs?.log ?? [];
      return { source: 'module_log', entries: entries.map((e) => ({
        date: e.date, action: e.action, request: e.request, response: e.response,
      })) };
    } catch {
      // Fallback: use activity log filtered for module entries
      const desc = options.serviceId ? `Service ID ${options.serviceId}` : 'Module';
      const res = await this.client.call<{
        activity: { entry: Array<{ date: string; description: string }> };
      }>('GetActivityLog', {
        description: desc,
        limitnum: options.limit ?? 50,
      });
      const entries = (res.activity?.entry ?? [])
        .filter((e) => /module/i.test(e.description))
        .map((e) => ({ date: e.date, action: 'activity', description: e.description }));
      return { source: 'activity_log', entries };
    }
  }

  async getServerModules(): Promise<Array<{
    module: string;
    servers: Array<{ id: number; name: string; hostname: string; active: boolean; percentUsed: number }>;
    totalServers: number;
    totalCapacity: number;
    totalUsed: number;
  }>> {
    const res = await this.client.call<{
      servers: Array<{
        id: number; name: string; hostname: string; module: string;
        activestatus: boolean; noofservices: number; maxallowedservices: number; percentused: number;
      }>;
    }>('GetServers');

    const byModule = new Map<string, Array<{
      id: number; name: string; hostname: string; active: boolean;
      percentUsed: number; used: number; capacity: number;
    }>>();

    for (const s of res.servers ?? []) {
      const key = s.module || 'unknown';
      if (!byModule.has(key)) byModule.set(key, []);
      byModule.get(key)!.push({
        id: s.id, name: s.name, hostname: s.hostname,
        active: s.activestatus, percentUsed: s.percentused,
        used: s.noofservices, capacity: s.maxallowedservices,
      });
    }

    return Array.from(byModule.entries()).map(([module, servers]) => ({
      module,
      servers: servers.map(({ id, name, hostname, active, percentUsed }) => ({ id, name, hostname, active, percentUsed })),
      totalServers: servers.length,
      totalCapacity: servers.reduce((sum, s) => sum + s.capacity, 0),
      totalUsed: servers.reduce((sum, s) => sum + s.used, 0),
    }));
  }

  async resyncService(
    serviceId: number,
    action: ModuleAction = 'Create',
  ): Promise<{ message: string }> {
    if (!ProvisioningDomain.SUPPORTED_ACTIONS.has(action)) {
      throw new Error(`Unsupported module action: ${action}`);
    }
    const res = await this.client.call<{ message: string }>('ModuleCustom', {
      serviceid: serviceId,
      func_name: action,
    });
    return { message: res.message ?? 'OK' };
  }
}
