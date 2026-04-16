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
}
