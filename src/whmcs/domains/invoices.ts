import type { WhmcsClient } from '../client.js';

type ItemOrigin = 'service-renewal' | 'domain-renewal' | 'addon' | 'manual';

interface RawInvoiceItem {
  id: number;
  type: string;
  relid: number;
  description: string;
  amount: string;
  taxed: number;
}

interface RawProduct {
  id: number;
  name: string;
  domain: string;
  status: string;
  billingcycle: string;
  recurringamount: string;
}

export interface AuditLineItem {
  id: number;
  type: string;
  relid: number;
  description: string;
  amount: string;
  taxed: boolean;
  origin: ItemOrigin;
  service?: {
    name: string;
    domain: string;
    status: string;
    billingcycle: string;
  };
}

export interface InvoiceAudit {
  invoiceid: number;
  invoicenum: string;
  userid: number;
  date: string;
  duedate: string;
  datepaid: string;
  status: string;
  paymentmethod: string;
  subtotal: string;
  credit: string;
  tax: string;
  total: string;
  balance: string;
  currencycode: string;
  items: AuditLineItem[];
}

function classifyOrigin(item: RawInvoiceItem): ItemOrigin {
  if (item.type === 'Hosting' && item.relid > 0) return 'service-renewal';
  if (item.type === 'Domain' && item.relid > 0) return 'domain-renewal';
  if (item.type === 'Addon' && item.relid > 0) return 'addon';
  return 'manual';
}

export interface PaymentAttempts {
  invoiceid: number;
  transactions: Array<{
    id: number;
    gateway: string;
    date: string;
    description: string;
    amountin: string;
    amountout: string;
    transid: string;
    refundid: number;
  }>;
  failedAttempts: Array<{
    date: string;
    gateway: string;
    error: string;
  }>;
}

export class InvoiceDomain {
  constructor(private client: WhmcsClient) {}

  async getInvoiceAudit(invoiceId: number): Promise<InvoiceAudit> {
    const res = await this.client.call<{
      invoiceid: number; invoicenum: string; userid: number;
      date: string; duedate: string; datepaid: string;
      status: string; paymentmethod: string;
      subtotal: string; credit: string; tax: string; total: string; balance: string;
      currencycode: string;
      items: { item: RawInvoiceItem[] };
    }>('GetInvoice', { invoiceid: invoiceId });

    const rawItems = res.items?.item ?? [];

    const serviceIds = rawItems
      .filter((i) => i.type === 'Hosting' && i.relid > 0)
      .map((i) => i.relid);

    let serviceMap = new Map<number, RawProduct>();
    if (serviceIds.length > 0) {
      try {
        const prods = await this.client.call<{
          products: { product: RawProduct[] };
        }>('GetClientsProducts', { clientid: res.userid, invoiceid: invoiceId });
        for (const p of prods.products?.product ?? []) {
          serviceMap.set(p.id, p);
        }
      } catch {
        // non-critical — items just won't have service enrichment
      }
    }

    const items: AuditLineItem[] = rawItems.map((raw) => {
      const svc = serviceMap.get(raw.relid);
      return {
        id: raw.id,
        type: raw.type,
        relid: raw.relid,
        description: raw.description,
        amount: raw.amount,
        taxed: raw.taxed === 1,
        origin: classifyOrigin(raw),
        service: svc
          ? {
              name: svc.name,
              domain: svc.domain,
              status: svc.status,
              billingcycle: svc.billingcycle,
            }
          : undefined,
      };
    });

    return {
      invoiceid: res.invoiceid,
      invoicenum: res.invoicenum,
      userid: res.userid,
      date: res.date,
      duedate: res.duedate,
      datepaid: res.datepaid,
      status: res.status,
      paymentmethod: res.paymentmethod,
      subtotal: res.subtotal,
      credit: res.credit,
      tax: res.tax,
      total: res.total,
      balance: res.balance,
      currencycode: res.currencycode,
      items,
    };
  }

  async getPaymentAttempts(invoiceId: number): Promise<PaymentAttempts> {
    const txRes = await this.client.call<{
      transactions: { transaction: Array<{
        id: number; gateway: string; date: string; description: string;
        amountin: string; amountout: string; transid: string;
        invoiceid: number; refundid: number;
      }> };
    }>('GetTransactions', { invoiceid: invoiceId });

    const transactions = (txRes.transactions?.transaction ?? []).map((t) => ({
      id: t.id,
      gateway: t.gateway,
      date: t.date,
      description: t.description,
      amountin: t.amountin,
      amountout: t.amountout,
      transid: t.transid,
      refundid: t.refundid,
    }));

    const actRes = await this.client.call<{
      activity: { entry: Array<{ date: string; description: string }> };
    }>('GetActivityLog', {
      description: `Invoice #${invoiceId}`,
      limitnum: 100,
    });

    const failedAttempts = (actRes.activity?.entry ?? [])
      .filter((e) => /Payment Attempt Failed/i.test(e.description) && e.description.includes(`#${invoiceId}`))
      .map((e) => {
        const gwMatch = /Gateway:\s*(\S+)/i.exec(e.description);
        const errMatch = /Error:\s*(.+)$/i.exec(e.description);
        return {
          date: e.date,
          gateway: gwMatch?.[1] ?? 'unknown',
          error: errMatch?.[1] ?? e.description,
        };
      });

    return { invoiceid: invoiceId, transactions, failedAttempts };
  }

  async getOrphanTransactions(options: { clientid?: number } = {}): Promise<
    Array<{
      id: number; gateway: string; date: string; description: string;
      amountin: string; amountout: string; transid: string;
      invoiceid: number; userid: number;
    }>
  > {
    const res = await this.client.call<{
      transactions: { transaction: Array<{
        id: number; userid: number; gateway: string; date: string;
        description: string; amountin: string; amountout: string;
        transid: string; invoiceid: number;
      }> };
    }>('GetTransactions', options.clientid ? { clientid: options.clientid } : {});

    return (res.transactions?.transaction ?? [])
      .filter((t) => t.invoiceid === 0)
      .map((t) => ({
        id: t.id,
        gateway: t.gateway,
        date: t.date,
        description: t.description,
        amountin: t.amountin,
        amountout: t.amountout,
        transid: t.transid,
        invoiceid: t.invoiceid,
        userid: t.userid,
      }));
  }

  async getDunningLog(
    invoiceId: number,
    options: { limit?: number } = {},
  ): Promise<Array<{ date: string; user: string; description: string }>> {
    const res = await this.client.call<{
      activity: { entry: Array<{ date: string; user: string; userid: number; description: string }> };
    }>('GetActivityLog', {
      description: `Invoice #${invoiceId}`,
      limitnum: options.limit ?? 100,
    });

    return (res.activity?.entry ?? [])
      .filter((e) => e.description.includes(`#${invoiceId}`))
      .map((e) => ({
        date: e.date,
        user: e.user,
        description: e.description,
      }));
  }

  async getCreditHistory(
    clientId: number,
    caps: { hasGetCredits: boolean },
  ): Promise<
    | { supported: true; credits: Array<{
        id: number; date: string; description: string;
        amount: string; relid: number;
      }> }
    | { supported: false; reason: string }
  > {
    if (!caps.hasGetCredits) {
      return {
        supported: false,
        reason: 'GetCredits API action requires WHMCS 7.1 or later.',
      };
    }
    const res = await this.client.call<{
      credits: { credit: Array<{
        id: number; date: string; description: string;
        amount: string; relid: number;
      }> };
    }>('GetCredits', { clientid: clientId });

    return {
      supported: true,
      credits: res.credits?.credit ?? [],
    };
  }
}
