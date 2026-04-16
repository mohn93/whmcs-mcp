import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { InvoiceDomain } from '../../../../src/whmcs/domains/invoices';
import { registerInvoiceTools } from '../../../../src/mcp/tools/invoices';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';

import invoiceFixture from '../../../fixtures/GetInvoice-detailed.json';
import txInvoiceFixture from '../../../fixtures/GetTransactions-invoice.json';
import txOrphanFixture from '../../../fixtures/GetTransactions-orphans.json';
import productsFixture from '../../../fixtures/GetClientsProducts-for-invoice.json';
import activityFixture from '../../../fixtures/GetActivityLog-invoice.json';
import creditsFixture from '../../../fixtures/GetCredits.json';

type Handler = (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

let server: MockWhmcsServer;
let inv: InvoiceDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetInvoice: invoiceFixture,
      GetTransactions: txInvoiceFixture,
      GetClientsProducts: productsFixture,
      GetActivityLog: activityFixture,
      GetCredits: creditsFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  inv = new InvoiceDomain(client);
});
afterAll(async () => { await server.stop(); });

function makeServer() {
  const handlers: Record<string, Handler> = {};
  const mcp = {
    registerTool: vi.fn((name: string, _schema: unknown, handler: Handler) => {
      handlers[name] = handler;
    }),
  };
  return { mcp, handlers };
}

describe('registerInvoiceTools', () => {
  it('registers 5 invoice tools', () => {
    const { mcp } = makeServer();
    registerInvoiceTools(mcp as never, {
      invoices: inv,
      capabilities: { hasGetCredits: true } as never,
    });
    const names = mcp.registerTool.mock.calls.map((c: any) => c[0]);
    expect(names).toEqual(expect.arrayContaining([
      'whmcs_get_invoice_audit',
      'whmcs_get_payment_attempts',
      'whmcs_get_orphan_transactions',
      'whmcs_get_credit_history',
      'whmcs_get_dunning_log',
    ]));
    expect(names).toHaveLength(5);
  });

  it('whmcs_get_invoice_audit returns JSON with items', async () => {
    const { mcp, handlers } = makeServer();
    registerInvoiceTools(mcp as never, { invoices: inv, capabilities: { hasGetCredits: true } as never });
    const out = await handlers['whmcs_get_invoice_audit']({ invoiceId: 5001 });
    expect(out.content[0].text).toContain('"invoiceid": 5001');
    expect(out.content[0].text).toContain('"origin"');
  });

  it('whmcs_get_credit_history surfaces unsupported state', async () => {
    const { mcp, handlers } = makeServer();
    registerInvoiceTools(mcp as never, { invoices: inv, capabilities: { hasGetCredits: false } as never });
    const out = await handlers['whmcs_get_credit_history']({ clientId: 42 });
    expect(out.content[0].text).toMatch(/7\.1/);
  });

  it('whmcs_get_payment_attempts returns transaction data', async () => {
    const { mcp, handlers } = makeServer();
    registerInvoiceTools(mcp as never, { invoices: inv, capabilities: { hasGetCredits: true } as never });
    const out = await handlers['whmcs_get_payment_attempts']({ invoiceId: 5001 });
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.invoiceid).toBe(5001);
    expect(parsed.transactions).toHaveLength(2);
  });

  it('whmcs_get_orphan_transactions returns orphan data', async () => {
    server.setFixture('GetTransactions', txOrphanFixture);
    const { mcp, handlers } = makeServer();
    registerInvoiceTools(mcp as never, { invoices: inv, capabilities: { hasGetCredits: true } as never });
    const out = await handlers['whmcs_get_orphan_transactions']({});
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].transid).toBe('PP-orphan-789');
    server.setFixture('GetTransactions', txInvoiceFixture);
  });

  it('whmcs_get_dunning_log returns activity entries', async () => {
    const { mcp, handlers } = makeServer();
    registerInvoiceTools(mcp as never, { invoices: inv, capabilities: { hasGetCredits: true } as never });
    const out = await handlers['whmcs_get_dunning_log']({ invoiceId: 5001 });
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].description).toMatch(/Payment Attempt Failed/);
  });

  it('whmcs_get_credit_history returns credits when supported', async () => {
    server.setFixture('GetCredits', creditsFixture);
    const { mcp, handlers } = makeServer();
    registerInvoiceTools(mcp as never, { invoices: inv, capabilities: { hasGetCredits: true } as never });
    const out = await handlers['whmcs_get_credit_history']({ clientId: 42 });
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.supported).toBe(true);
    expect(parsed.credits).toHaveLength(2);
  });
});
