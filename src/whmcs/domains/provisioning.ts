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

  async getServicesByServer(serverId: number): Promise<{
    serverId: number;
    totalScanned: number;
    services: Array<{
      id: number; clientid: number; name: string; domain: string;
      status: string; regdate: string; nextduedate: string;
    }>;
    statusCounts: Record<string, number>;
    note?: string;
  }> {
    // WHMCS GetClientsProducts requires a clientid to return the full product record
    // (including serverid). Without clientid, it may omit serverid entirely.
    // Strategy: paginate with a dummy clientid is not viable, so we scan with
    // the serverid param set (WHMCS may or may not honor it) AND also check
    // the servername/serverip fields as fallback identifiers.

    // First, get the server's name and IP for fallback matching
    let serverName = '';
    let serverIp = '';
    try {
      const serversRes = await this.client.call<{
        servers: Array<{ id: number; name: string; ipaddress: string }>;
      }>('GetServers');
      const srv = (serversRes.servers ?? []).find((s) => Number(s.id) === serverId);
      if (srv) {
        serverName = srv.name;
        serverIp = srv.ipaddress;
      }
    } catch {
      // non-critical — we'll still try to match by serverid
    }

    const PAGE_SIZE = 250;
    const MAX_PAGES = 20;
    const matched: Array<{
      id: number; clientid: number; name: string; domain: string;
      status: string; regdate: string; nextduedate: string;
    }> = [];
    let totalScanned = 0;
    let hasServerIdField = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const res = await this.client.call<{
          totalresults: number;
          products: { product: Array<Record<string, unknown>> };
        }>('GetClientsProducts', {
          limitstart: page * PAGE_SIZE,
          limitnum: PAGE_SIZE,
        });

        const products = res.products?.product ?? [];
        totalScanned += products.length;

        // On first page, log what fields are available for debugging
        if (page === 0 && products.length > 0) {
          const fields = Object.keys(products[0]);
          hasServerIdField = fields.includes('serverid');
          if (process.env.WHMCS_DEBUG === 'true') {
            console.error(`[whmcs-mcp] GetClientsProducts fields: ${fields.join(', ')}`);
            console.error(`[whmcs-mcp] Sample serverid value: ${JSON.stringify(products[0].serverid)} (type: ${typeof products[0].serverid})`);
            if (products[0].servername !== undefined) {
              console.error(`[whmcs-mcp] Sample servername: ${JSON.stringify(products[0].servername)}`);
            }
          }
        }

        for (const p of products) {
          // Match by serverid (number or string), servername, or serverip
          const pServerId = Number(p.serverid ?? 0);
          const pServerName = String(p.servername ?? '');
          const pServerIp = String(p.serverip ?? '');

          const isMatch =
            pServerId === serverId ||
            (serverName && pServerName === serverName) ||
            (serverIp && serverIp !== '127.0.0.1' && pServerIp === serverIp);

          if (isMatch) {
            matched.push({
              id: Number(p.id),
              clientid: Number(p.clientid),
              name: String(p.name ?? ''),
              domain: String(p.domain ?? ''),
              status: String(p.status ?? ''),
              regdate: String(p.regdate ?? ''),
              nextduedate: String(p.nextduedate ?? ''),
            });
          }
        }

        if (products.length < PAGE_SIZE) break;
      } catch (err) {
        if (matched.length > 0 || totalScanned > 0) break;
        throw new Error(
          `Failed to fetch services for server ${serverId}: ${(err as Error).message}. ` +
          `This may be caused by WHMCS PHP memory limits — ask your sysadmin to increase memory_limit in php.ini.`
        );
      }
    }

    // Compute status breakdown
    const statusCounts: Record<string, number> = {};
    for (const s of matched) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    }

    let note: string | undefined;
    if (matched.length === 0 && totalScanned > 0) {
      note = !hasServerIdField
        ? `WHMCS returned ${totalScanned} services but none included a serverid field. ` +
          `This WHMCS version may not expose serverid in bulk GetClientsProducts responses. ` +
          `Try querying specific clients with whmcs_get_client_timeline or whmcs_get_service_details instead.`
        : `Scanned ${totalScanned} services but none matched server ${serverId} (${serverName || 'unknown'}). ` +
          `The server may have services assigned via a different mechanism.`;
    }

    return { serverId, totalScanned, services: matched, statusCounts, ...(note ? { note } : {}) };
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
