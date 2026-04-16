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
});
