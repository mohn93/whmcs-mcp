import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { InvoiceDomain } from '../../../../src/whmcs/domains/invoices';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import invoiceFixture from '../../../fixtures/GetInvoice-detailed.json';
import txInvoiceFixture from '../../../fixtures/GetTransactions-invoice.json';
import txOrphanFixture from '../../../fixtures/GetTransactions-orphans.json';
import productsFixture from '../../../fixtures/GetClientsProducts-for-invoice.json';
import activityFixture from '../../../fixtures/GetActivityLog-invoice.json';

let server: MockWhmcsServer;
let inv: InvoiceDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetInvoice: invoiceFixture,
      GetTransactions: txInvoiceFixture,
      GetClientsProducts: productsFixture,
      GetActivityLog: activityFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  inv = new InvoiceDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('InvoiceDomain.getInvoiceAudit', () => {
  it('returns invoice with enriched line items', async () => {
    const audit = await inv.getInvoiceAudit(5001);
    expect(audit.invoiceid).toBe(5001);
    expect(audit.status).toBe('Unpaid');
    expect(audit.total).toBe('30.00');
    expect(audit.items).toHaveLength(3);
  });

  it('classifies line items by origin', async () => {
    const audit = await inv.getInvoiceAudit(5001);
    const hosting = audit.items.filter((i) => i.origin === 'service-renewal');
    const manual = audit.items.filter((i) => i.origin === 'manual');
    expect(hosting).toHaveLength(2);
    expect(manual).toHaveLength(1);
    expect(manual[0].description).toBe('Setup Fee');
  });

  it('links service items to their service details', async () => {
    const audit = await inv.getInvoiceAudit(5001);
    const item = audit.items.find((i) => i.relid === 1001)!;
    expect(item.service?.name).toBe('Starter Hosting');
    expect(item.service?.domain).toBe('example.test');
  });

  it('sends invoiceid to WHMCS', async () => {
    await inv.getInvoiceAudit(5001);
    expect(server.lastRequest()?.params.get('invoiceid')).toBe('5001');
  });
});

describe('InvoiceDomain.getPaymentAttempts', () => {
  it('returns transactions linked to the invoice', async () => {
    const attempts = await inv.getPaymentAttempts(5001);
    expect(attempts.transactions).toHaveLength(2);
    expect(attempts.transactions[0].gateway).toBe('stripe');
    expect(attempts.transactions[0].amountin).toBe('20.00');
    expect(attempts.transactions[1].amountin).toBe('30.00');
  });

  it('includes failed payment attempts from the activity log', async () => {
    const attempts = await inv.getPaymentAttempts(5001);
    expect(attempts.failedAttempts).toHaveLength(2);
    expect(attempts.failedAttempts[0].error).toMatch(/insufficient funds/);
    expect(attempts.failedAttempts[1].error).toMatch(/Card expired/);
  });

  it('sends invoiceid filter to GetTransactions', async () => {
    await inv.getPaymentAttempts(5001);
    const last = server.lastRequest();
    expect(last?.params.get('action')).toBe('GetActivityLog');
  });
});
