import type { WhmcsClient } from '../client.js';

export interface TimelineEvent {
  type: 'order' | 'invoice' | 'service' | 'ticket' | 'domain';
  id: number;
  date: string;
  summary: string;
  status: string;
}

export interface ClientTimeline {
  clientId: number;
  events: TimelineEvent[];
}

export class TimelineDomain {
  constructor(private client: WhmcsClient) {}

  async getClientTimeline(clientId: number, options: { limitPerCategory?: number } = {}): Promise<ClientTimeline> {
    const limit = options.limitPerCategory ?? 10;
    const [orders, invoices, products, tickets, domains] = await Promise.all([
      this.fetchOrders(clientId, limit),
      this.fetchInvoices(clientId, limit),
      this.fetchServices(clientId, limit),
      this.fetchTickets(clientId, limit),
      this.fetchDomains(clientId, limit),
    ]);

    const events: TimelineEvent[] = [
      ...orders, ...invoices, ...products, ...tickets, ...domains,
    ];

    events.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

    return { clientId, events };
  }

  private async fetchOrders(clientId: number, limit: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        orders: { order: Array<{ id: number; date: string; amount: string; status: string }> };
      }>('GetOrders', { userid: clientId, limitnum: limit });
      return (res.orders?.order ?? []).map((o) => ({
        type: 'order' as const,
        id: o.id,
        date: o.date,
        summary: `Order #${o.id} — $${o.amount} (${o.status})`,
        status: o.status,
      }));
    } catch { return []; }
  }

  private async fetchInvoices(clientId: number, limit: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        invoices: { invoice: Array<{ id: number; date: string; total: string; status: string }> };
      }>('GetInvoices', { userid: clientId, limitnum: limit });
      return (res.invoices?.invoice ?? []).map((i) => ({
        type: 'invoice' as const,
        id: i.id,
        date: i.date,
        summary: `Invoice #${i.id} — $${i.total} (${i.status})`,
        status: i.status,
      }));
    } catch { return []; }
  }

  private async fetchServices(clientId: number, limit: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        products: { product: Array<{ id: number; regdate: string; name: string; domain: string; status: string }> };
      }>('GetClientsProducts', { clientid: clientId, limitnum: limit });
      return (res.products?.product ?? []).map((p) => ({
        type: 'service' as const,
        id: p.id,
        date: p.regdate,
        summary: `${p.name} — ${p.domain} (${p.status})`,
        status: p.status,
      }));
    } catch { return []; }
  }

  private async fetchTickets(clientId: number, limit: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        tickets: { ticket: Array<{ id: number; date: string; subject: string; status: string }> };
      }>('GetTickets', { clientid: clientId, limitnum: limit });
      return (res.tickets?.ticket ?? []).map((t) => ({
        type: 'ticket' as const,
        id: t.id,
        date: t.date,
        summary: `[${t.status}] ${t.subject}`,
        status: t.status,
      }));
    } catch { return []; }
  }

  private async fetchDomains(clientId: number, limit: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        domains: { domain: Array<{ id: number; regdate: string; domainname: string; expirydate: string; status: string }> };
      }>('GetClientsDomains', { clientid: clientId, limitnum: limit });
      return (res.domains?.domain ?? []).map((d) => ({
        type: 'domain' as const,
        id: d.id,
        date: d.regdate,
        summary: `${d.domainname} — expires ${d.expirydate} (${d.status})`,
        status: d.status,
      }));
    } catch { return []; }
  }

  async getClientAutoAuthUrl(
    clientId: number,
    caps: { hasCreateSsoToken: boolean },
  ): Promise<
    | { supported: true; redirectUrl: string; accessToken: string }
    | { supported: false; reason: string }
  > {
    if (!caps.hasCreateSsoToken) {
      return {
        supported: false,
        reason: 'CreateSsoToken API action requires WHMCS 7.7 or later.',
      };
    }
    const res = await this.client.call<{
      access_token: string;
      redirect_url: string;
    }>('CreateSsoToken', { client_id: clientId });

    return {
      supported: true,
      redirectUrl: res.redirect_url,
      accessToken: res.access_token,
    };
  }
}
