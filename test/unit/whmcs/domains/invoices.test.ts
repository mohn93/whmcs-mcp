import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { InvoiceDomain } from '../../../../src/whmcs/domains/invoices';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import invoiceFixture from '../../../fixtures/GetInvoice-detailed.json';
import txInvoiceFixture from '../../../fixtures/GetTransactions-invoice.json';
import txOrphanFixture from '../../../fixtures/GetTransactions-orphans.json';
import productsFixture from '../../../fixtures/GetClientsProducts-for-invoice.json';
import activityFixture from '../../../fixtures/GetActivityLog-invoice.json';
import creditsFixture from '../../../fixtures/GetCredits.json';

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

  it('classifies domain-type line item as domain-renewal', async () => {
    server.setFixture('GetInvoice', {
      result: 'success',
      invoiceid: 5002, invoicenum: '5002', userid: 42,
      date: '2026-01-01', duedate: '2026-01-15', datepaid: '0000-00-00 00:00:00',
      status: 'Unpaid', paymentmethod: 'stripe',
      subtotal: '15.00', credit: '0.00', tax: '0.00', total: '15.00', balance: '15.00',
      currencycode: 'USD',
      items: {
        item: [
          { id: 201, type: 'Domain', relid: 301, description: 'Domain Renewal - example.test', amount: '15.00', taxed: 0 },
        ],
      },
    });
    const audit = await inv.getInvoiceAudit(5002);
    expect(audit.items).toHaveLength(1);
    expect(audit.items[0].origin).toBe('domain-renewal');
    // Restore
    server.setFixture('GetInvoice', invoiceFixture);
  });

  it('classifies addon-type line item as addon', async () => {
    server.setFixture('GetInvoice', {
      result: 'success',
      invoiceid: 5003, invoicenum: '5003', userid: 42,
      date: '2026-01-01', duedate: '2026-01-15', datepaid: '0000-00-00 00:00:00',
      status: 'Unpaid', paymentmethod: 'stripe',
      subtotal: '5.00', credit: '0.00', tax: '0.00', total: '5.00', balance: '5.00',
      currencycode: 'USD',
      items: {
        item: [
          { id: 301, type: 'Addon', relid: 50, description: 'SSL Certificate Addon', amount: '5.00', taxed: 1 },
        ],
      },
    });
    const audit = await inv.getInvoiceAudit(5003);
    expect(audit.items).toHaveLength(1);
    expect(audit.items[0].origin).toBe('addon');
    expect(audit.items[0].taxed).toBe(true);
    // Restore
    server.setFixture('GetInvoice', invoiceFixture);
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

  it('returns empty failedAttempts array when no failures in activity log', async () => {
    server.setFixture('GetActivityLog', {
      result: 'success', totalresults: 0, activity: { entry: [] },
    });
    const attempts = await inv.getPaymentAttempts(5001);
    expect(attempts.failedAttempts).toHaveLength(0);
    expect(attempts.failedAttempts).toEqual([]);
    // transactions should still be returned
    expect(attempts.transactions).toHaveLength(2);
    // Restore
    server.setFixture('GetActivityLog', activityFixture);
  });
});

describe('InvoiceDomain.getOrphanTransactions', () => {
  it('returns transactions with no invoice linkage', async () => {
    server.setFixture('GetTransactions', txOrphanFixture);
    const orphans = await inv.getOrphanTransactions();
    expect(orphans).toHaveLength(1);
    expect(orphans[0].transid).toBe('PP-orphan-789');
    expect(orphans[0].invoiceid).toBe(0);
    expect(orphans[0].amountin).toBe('50.00');
    // restore fixture for other tests
    server.setFixture('GetTransactions', txInvoiceFixture);
  });

  it('includes gateway and date in each orphan', async () => {
    server.setFixture('GetTransactions', txOrphanFixture);
    const orphans = await inv.getOrphanTransactions();
    expect(orphans[0].gateway).toBe('paypal');
    expect(orphans[0].date).toBe('2026-02-01 11:00:00');
    server.setFixture('GetTransactions', txInvoiceFixture);
  });

  it('sends clientid param when filter is provided', async () => {
    server.setFixture('GetTransactions', txOrphanFixture);
    await inv.getOrphanTransactions({ clientid: 42 });
    expect(server.lastRequest()?.params.get('clientid')).toBe('42');
    server.setFixture('GetTransactions', txInvoiceFixture);
  });

  it('returns empty array when all transactions have invoices', async () => {
    // txInvoiceFixture has transactions with invoiceid=5001
    server.setFixture('GetTransactions', txInvoiceFixture);
    const orphans = await inv.getOrphanTransactions();
    expect(orphans).toHaveLength(0);
  });
});

describe('InvoiceDomain.getDunningLog', () => {
  it('returns payment-failure and invoice-related activity entries', async () => {
    const log = await inv.getDunningLog(5001);
    expect(log).toHaveLength(3);
    expect(log[0].description).toMatch(/Payment Attempt Failed/);
    expect(log[2].description).toMatch(/Invoice Created/);
  });

  it('passes invoice number filter to GetActivityLog', async () => {
    await inv.getDunningLog(5001);
    expect(server.lastRequest()?.params.get('description')).toContain('5001');
  });

  it('returns empty array when activity log has no entries', async () => {
    server.setFixture('GetActivityLog', {
      result: 'success', totalresults: 0, activity: { entry: [] },
    });
    const log = await inv.getDunningLog(5001);
    expect(log).toHaveLength(0);
    expect(log).toEqual([]);
    // Restore
    server.setFixture('GetActivityLog', activityFixture);
  });
});

describe('InvoiceDomain.getCreditHistory', () => {
  it('returns credit entries when capability is present', async () => {
    server.setFixture('GetCredits', creditsFixture);
    const result = await inv.getCreditHistory(42, { hasGetCredits: true });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.credits).toHaveLength(2);
      expect(result.credits[0].amount).toBe('10.00');
      expect(result.credits[1].amount).toBe('-5.00');
    }
  });

  it('reports unsupported when capability is missing', async () => {
    const result = await inv.getCreditHistory(42, { hasGetCredits: false });
    expect(result.supported).toBe(false);
    if (!result.supported) {
      expect(result.reason).toMatch(/7\.1/);
    }
  });

  it('returns empty credits array when client has no credit history', async () => {
    server.setFixture('GetCredits', {
      result: 'success', totalresults: 0, credits: { credit: [] },
    });
    const result = await inv.getCreditHistory(42, { hasGetCredits: true });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.credits).toHaveLength(0);
      expect(result.credits).toEqual([]);
    }
    // Restore
    server.setFixture('GetCredits', creditsFixture);
  });
});
