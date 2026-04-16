import type { WhmcsClient } from '../client.js';

export interface HealthSummary {
  stats: {
    income_today: string;
    orders_pending: number;
    invoices_overdue: number;
    tickets_awaiting: number;
  };
  servers: {
    total: number;
    hotCount: number;
    hotServers: string[];
  };
  moduleQueue:
    | { supported: boolean; pendingCount: number }
    | { supported: false; reason: string };
}

export interface Inconsistencies {
  overdueInvoices: Array<{
    id: number;
    userid: number;
    total: string;
    duedate: string;
    daysOverdue: number;
  }>;
  staleServices: Array<{
    id: number;
    clientid: number;
    name: string;
    status: string;
    regdate: string;
  }>;
}

export class HealthDomain {
  constructor(private client: WhmcsClient) {}

  async getHealthSummary(caps: {
    hasModuleQueue: boolean;
  }): Promise<HealthSummary> {
    // Fetch stats
    const statsRes = await this.client.call<{
      stats: {
        income_today: string;
        orders_pending_count: number;
        tickets_awaitingreply_count: number;
        invoices_unpaid_count: number;
      };
    }>('GetStats');

    const stats = {
      income_today: statsRes.stats?.income_today ?? '0.00',
      orders_pending: statsRes.stats?.orders_pending_count ?? 0,
      invoices_overdue: statsRes.stats?.invoices_unpaid_count ?? 0,
      tickets_awaiting: statsRes.stats?.tickets_awaitingreply_count ?? 0,
    };

    // Fetch servers
    const serversRes = await this.client.call<{
      servers: Array<{
        id: number;
        name: string;
        hostname: string;
        ipaddress: string;
        noofservices: number;
        maxallowedservices: number;
        percentused: number;
        activestatus: boolean;
        module: string;
      }>;
    }>('GetServers');

    const allServers = serversRes.servers ?? [];
    const hotServers = allServers.filter((s) => s.percentused >= 90);
    const servers = {
      total: allServers.length,
      hotCount: hotServers.length,
      hotServers: hotServers.map((s) => s.name),
    };

    // Fetch module queue
    let moduleQueue: HealthSummary['moduleQueue'];
    if (!caps.hasModuleQueue) {
      moduleQueue = {
        supported: false,
        reason: 'ModuleQueue API action requires WHMCS 8.0 or later.',
      };
    } else {
      const queueRes = await this.client.call<{
        queue: {
          item: Array<{
            id: number;
            service_type: string;
            service_id: number;
            module: string;
            action: string;
          }>;
        };
      }>('ModuleQueue');
      const items = queueRes.queue?.item ?? [];
      moduleQueue = { supported: true, pendingCount: items.length };
    }

    return { stats, servers, moduleQueue };
  }

  async findInconsistencies(): Promise<Inconsistencies> {
    // Fetch unpaid invoices
    const invoicesRes = await this.client.call<{
      invoices: {
        invoice: Array<{
          id: number;
          userid: number;
          total: string;
          duedate: string;
          status: string;
        }>;
      };
    }>('GetInvoices', { status: 'Unpaid' });

    const now = new Date();
    const rawInvoices = invoicesRes.invoices?.invoice ?? [];
    const overdueInvoices = rawInvoices
      .map((inv) => {
        const dueDate = new Date(inv.duedate);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          id: inv.id,
          userid: inv.userid,
          total: inv.total,
          duedate: inv.duedate,
          daysOverdue,
        };
      })
      .filter((inv) => inv.daysOverdue > 90);

    // Fetch services in Pending status
    const productsRes = await this.client.call<{
      products: {
        product: Array<{
          id: number;
          clientid: number;
          name: string;
          status: string;
          regdate: string;
        }>;
      };
    }>('GetClientsProducts');

    const rawProducts = productsRes.products?.product ?? [];
    const staleServices = rawProducts
      .filter((svc) => {
        if (svc.status !== 'Pending') return false;
        const regDate = new Date(svc.regdate);
        const daysOld = Math.floor(
          (now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysOld > 7;
      })
      .map((svc) => ({
        id: svc.id,
        clientid: svc.clientid,
        name: svc.name,
        status: svc.status,
        regdate: svc.regdate,
      }));

    return { overdueInvoices, staleServices };
  }
}
