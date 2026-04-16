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

  async getClientTimeline(clientId: number): Promise<ClientTimeline> {
    const [orders, invoices, products, tickets, domains] = await Promise.all([
      this.fetchOrders(clientId),
      this.fetchInvoices(clientId),
      this.fetchServices(clientId),
      this.fetchTickets(clientId),
      this.fetchDomains(clientId),
    ]);

    const events: TimelineEvent[] = [
      ...orders, ...invoices, ...products, ...tickets, ...domains,
    ];

    events.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

    return { clientId, events };
  }

  private async fetchOrders(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        orders: { order: Array<{ id: number; date: string; amount: string; status: string }> };
      }>('GetOrders', { userid: clientId });
      return (res.orders?.order ?? []).map((o) => ({
        type: 'order' as const,
        id: o.id,
        date: o.date,
        summary: `Order #${o.id} — $${o.amount} (${o.status})`,
        status: o.status,
      }));
    } catch { return []; }
  }

  private async fetchInvoices(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        invoices: { invoice: Array<{ id: number; date: string; total: string; status: string }> };
      }>('GetInvoices', { userid: clientId });
      return (res.invoices?.invoice ?? []).map((i) => ({
        type: 'invoice' as const,
        id: i.id,
        date: i.date,
        summary: `Invoice #${i.id} — $${i.total} (${i.status})`,
        status: i.status,
      }));
    } catch { return []; }
  }

  private async fetchServices(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        products: { product: Array<{ id: number; regdate: string; name: string; domain: string; status: string }> };
      }>('GetClientsProducts', { clientid: clientId });
      return (res.products?.product ?? []).map((p) => ({
        type: 'service' as const,
        id: p.id,
        date: p.regdate,
        summary: `${p.name} — ${p.domain} (${p.status})`,
        status: p.status,
      }));
    } catch { return []; }
  }

  private async fetchTickets(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        tickets: { ticket: Array<{ id: number; date: string; subject: string; status: string }> };
      }>('GetTickets', { clientid: clientId });
      return (res.tickets?.ticket ?? []).map((t) => ({
        type: 'ticket' as const,
        id: t.id,
        date: t.date,
        summary: `[${t.status}] ${t.subject}`,
        status: t.status,
      }));
    } catch { return []; }
  }

  private async fetchDomains(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        domains: { domain: Array<{ id: number; regdate: string; domainname: string; expirydate: string; status: string }> };
      }>('GetClientsDomains', { clientid: clientId });
      return (res.domains?.domain ?? []).map((d) => ({
        type: 'domain' as const,
        id: d.id,
        date: d.regdate,
        summary: `${d.domainname} — expires ${d.expirydate} (${d.status})`,
        status: d.status,
      }));
    } catch { return []; }
  }
}
