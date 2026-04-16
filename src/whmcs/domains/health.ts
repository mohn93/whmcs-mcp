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
  errors: string[];
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
    daysStale: number;
  }>;
  errors: string[];
}

export class HealthDomain {
  constructor(private client: WhmcsClient) {}

  async getHealthSummary(caps: {
    hasModuleQueue: boolean;
  }): Promise<HealthSummary> {
    const errors: string[] = [];

    // Fetch stats
    let stats = {
      income_today: '0.00',
      orders_pending: 0,
      invoices_overdue: 0,
      tickets_awaiting: 0,
    };
    try {
      const statsRes = await this.client.call<{
        stats: {
          income_today: string;
          orders_pending_count: number;
          tickets_awaitingreply_count: number;
          invoices_unpaid_count: number;
        };
      }>('GetStats');
      stats = {
        income_today: statsRes.stats?.income_today ?? '0.00',
        orders_pending: statsRes.stats?.orders_pending_count ?? 0,
        invoices_overdue: statsRes.stats?.invoices_unpaid_count ?? 0,
        tickets_awaiting: statsRes.stats?.tickets_awaitingreply_count ?? 0,
      };
    } catch (err) {
      errors.push(`GetStats failed: ${(err as Error).message}`);
    }

    // Fetch servers
    let servers = { total: 0, hotCount: 0, hotServers: [] as string[] };
    try {
      const serversRes = await this.client.call<{
        servers: Array<{
          name: string;
          percentused: number;
        }>;
      }>('GetServers');
      const allServers = serversRes.servers ?? [];
      const hotServers = allServers.filter((s) => s.percentused >= 90);
      servers = {
        total: allServers.length,
        hotCount: hotServers.length,
        hotServers: hotServers.map((s) => s.name),
      };
    } catch (err) {
      errors.push(`GetServers failed: ${(err as Error).message}`);
    }

    // Fetch module queue
    let moduleQueue: HealthSummary['moduleQueue'];
    if (!caps.hasModuleQueue) {
      moduleQueue = {
        supported: false,
        reason: 'ModuleQueue API action requires WHMCS 8.0 or later.',
      };
    } else {
      try {
        const queueRes = await this.client.call<{
          queue: { item: Array<{ id: number }> };
        }>('ModuleQueue');
        const items = queueRes.queue?.item ?? [];
        moduleQueue = { supported: true, pendingCount: items.length };
      } catch (err) {
        errors.push(`ModuleQueue failed: ${(err as Error).message}`);
        moduleQueue = { supported: true, pendingCount: 0 };
      }
    }

    return { stats, servers, moduleQueue, errors };
  }

  async findInconsistencies(options: { limit?: number } = {}): Promise<Inconsistencies> {
    const limit = options.limit ?? 25;
    const errors: string[] = [];
    const now = new Date();

    // Fetch unpaid invoices — use WHMCS's "Overdue" status which filters correctly
    // (accounts for client status, grace periods, etc.)
    let overdueInvoices: Inconsistencies['overdueInvoices'] = [];
    try {
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
      }>('GetInvoices', { status: 'Overdue', limitnum: 250 });

      overdueInvoices = (invoicesRes.invoices?.invoice ?? [])
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
        .filter((inv) => inv.daysOverdue > 90)
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .slice(0, limit);
    } catch (err) {
      errors.push(`GetInvoices (Overdue) failed: ${(err as Error).message}`);

      // Fallback: try "Unpaid" status with date filter
      try {
        const fallbackRes = await this.client.call<{
          invoices: {
            invoice: Array<{
              id: number;
              userid: number;
              total: string;
              duedate: string;
              status: string;
            }>;
          };
        }>('GetInvoices', { status: 'Unpaid', limitnum: 250 });

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);

        overdueInvoices = (fallbackRes.invoices?.invoice ?? [])
          .filter((inv) => new Date(inv.duedate) < cutoff)
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
          // Skip ancient invoices (> 2 years old) — likely abandoned accounts
          .filter((inv) => inv.daysOverdue < 730)
          .sort((a, b) => b.daysOverdue - a.daysOverdue)
          .slice(0, limit);

        errors.push('Fell back to Unpaid status with 90-730 day filter');
      } catch (err2) {
        errors.push(`GetInvoices (Unpaid fallback) also failed: ${(err2 as Error).message}`);
      }
    }

    // Fetch services in Pending status — paginate to avoid WHMCS OOM
    let staleServices: Inconsistencies['staleServices'] = [];
    try {
      const PAGE_SIZE = 100;
      const allPending: Array<{ id: number; clientid: number; name: string; status: string; regdate: string }> = [];

      for (let page = 0; page < 5; page++) {
        const productsRes = await this.client.call<{
          products: {
            product: Array<{
              id: number; clientid: number; name: string; status: string; regdate: string;
            }>;
          };
        }>('GetClientsProducts', {
          status: 'Pending',
          limitstart: page * PAGE_SIZE,
          limitnum: PAGE_SIZE,
        });
        const products = productsRes.products?.product ?? [];
        allPending.push(...products);
        if (products.length < PAGE_SIZE) break;
      }

      staleServices = allPending
        .filter((svc) => {
          if (svc.status !== 'Pending') return false;
          const regDate = new Date(svc.regdate);
          const daysOld = Math.floor(
            (now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          return daysOld > 7;
        })
        .map((svc) => {
          const regDate = new Date(svc.regdate);
          const daysStale = Math.floor(
            (now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          return {
            id: svc.id,
            clientid: svc.clientid,
            name: svc.name,
            status: svc.status,
            regdate: svc.regdate,
            daysStale,
          };
        })
        .sort((a, b) => b.daysStale - a.daysStale)
        .slice(0, limit);
    } catch (err) {
      errors.push(`GetClientsProducts (Pending) failed: ${(err as Error).message}`);
    }

    return { overdueInvoices, staleServices, errors };
  }
}
