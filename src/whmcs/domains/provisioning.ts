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
    serverName: string;
    serverInfo: { hostname: string; ip: string; module: string; activeServices: number; capacity: number } | null;
    services: Array<{
      id: number; clientid: number; name: string; domain: string;
      status: string; regdate: string; nextduedate: string;
    }>;
    statusCounts: Record<string, number>;
    recentActivity: Array<{ date: string; description: string }>;
    note: string;
  }> {
    // WHMCS API limitation: GetClientsProducts does NOT populate serverid/servername
    // fields in bulk (non-client-specific) responses. The only reliable way to find
    // services on a server is through activity log correlation or per-client lookups.
    //
    // Strategy:
    // 1. Get server info from GetServers
    // 2. Search activity log for provisioning events mentioning the server
    // 3. For any service IDs found, fetch their details individually
    // 4. Return what we found + guidance for the agent

    // Step 1: Get server info
    let serverName = '';
    let serverInfo: { hostname: string; ip: string; module: string; activeServices: number; capacity: number } | null = null;
    try {
      const serversRes = await this.client.call<{
        servers: Array<{
          id: number; name: string; hostname: string; ipaddress: string;
          module: string; noofservices: number; maxallowedservices: number;
        }>;
      }>('GetServers');
      const srv = (serversRes.servers ?? []).find((s) => Number(s.id) === serverId);
      if (srv) {
        serverName = srv.name;
        serverInfo = {
          hostname: srv.hostname,
          ip: srv.ipaddress,
          module: srv.module,
          activeServices: srv.noofservices,
          capacity: srv.maxallowedservices,
        };
      }
    } catch {
      // continue without server info
    }

    // Step 2: Search activity log for this server's provisioning events
    const recentActivity: Array<{ date: string; description: string }> = [];
    const serviceIds = new Set<number>();
    try {
      const searchTerms = [serverName, `server ${serverId}`].filter(Boolean);
      for (const term of searchTerms) {
        const actRes = await this.client.call<{
          activity: { entry: Array<{ date: string; description: string }> };
        }>('GetActivityLog', { description: term, limitnum: 50 });

        for (const entry of actRes.activity?.entry ?? []) {
          recentActivity.push({ date: entry.date, description: entry.description });
          // Extract service IDs from log entries like "Service ID 1234"
          const matches = entry.description.matchAll(/Service (?:ID )?#?(\d+)/gi);
          for (const m of matches) {
            serviceIds.add(Number(m[1]));
          }
        }
      }
    } catch {
      // non-critical
    }

    // Step 3: Fetch details for discovered service IDs
    const services: Array<{
      id: number; clientid: number; name: string; domain: string;
      status: string; regdate: string; nextduedate: string;
    }> = [];
    const checked = new Set<number>();

    for (const sid of serviceIds) {
      if (checked.has(sid)) continue;
      checked.add(sid);
      try {
        const res = await this.client.call<{
          products: { product: Array<{
            id: number; clientid: number; name: string; domain: string;
            status: string; regdate: string; nextduedate: string;
            serverid: number; servername: string;
          }> };
        }>('GetClientsProducts', { serviceid: sid });

        const p = res.products?.product?.[0];
        if (p && (Number(p.serverid) === serverId || p.servername === serverName)) {
          services.push({
            id: Number(p.id), clientid: Number(p.clientid),
            name: String(p.name), domain: String(p.domain),
            status: String(p.status), regdate: String(p.regdate),
            nextduedate: String(p.nextduedate),
          });
        }
      } catch {
        // skip services we can't fetch
      }
      // Safety cap: don't fetch more than 30 individual services
      if (checked.size >= 30) break;
    }

    // Deduplicate
    const uniqueServices = Array.from(
      new Map(services.map((s) => [s.id, s])).values(),
    );

    const statusCounts: Record<string, number> = {};
    for (const s of uniqueServices) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    }

    const found = uniqueServices.length;
    const expected = serverInfo?.activeServices ?? 0;
    const note = found > 0
      ? `Found ${found} services on ${serverName || `server ${serverId}`} via activity log correlation` +
        (found < expected ? `. Server reports ${expected} active services — use whmcs_get_service_details on specific service IDs to find more, or query specific clients with whmcs_get_client_timeline.` : '.')
      : `Could not find services for ${serverName || `server ${serverId}`} via activity log. ` +
        `WHMCS does not support listing services by server directly. ` +
        `To find services on this server, query specific clients using whmcs_get_client_timeline ` +
        `or check recent orders, or look up known service IDs with whmcs_get_service_details.`;

    return {
      serverId,
      serverName: serverName || `server-${serverId}`,
      serverInfo,
      services: uniqueServices,
      statusCounts,
      recentActivity: recentActivity.slice(0, 20),
      note,
    };
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
