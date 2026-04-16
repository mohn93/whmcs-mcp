import type { InvoiceDomain } from '../../whmcs/domains/invoices.js';
import type { Capabilities } from '../../whmcs/version.js';

export interface InvoiceToolDeps {
  invoices: InvoiceDomain;
  capabilities: Capabilities;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

export function registerInvoiceTools(server: any, deps: InvoiceToolDeps): void {
  server.registerTool(
    'whmcs_get_invoice_audit',
    {
      title: 'Get Invoice Audit',
      description: 'Returns an invoice with enriched line items — each classified by origin (service-renewal, domain-renewal, addon, manual) and linked to service details where applicable.',
      inputSchema: {
        invoiceId: { type: 'number', description: 'The WHMCS invoice ID' },
      },
    },
    async ({ invoiceId }: { invoiceId: number }) => {
      try { return ok(await deps.invoices.getInvoiceAudit(invoiceId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_payment_attempts',
    {
      title: 'Get Payment Attempts',
      description: 'Returns all transactions (successful + failed) for an invoice, plus failed gateway attempts extracted from the activity log.',
      inputSchema: {
        invoiceId: { type: 'number', description: 'The WHMCS invoice ID' },
      },
    },
    async ({ invoiceId }: { invoiceId: number }) => {
      try { return ok(await deps.invoices.getPaymentAttempts(invoiceId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_orphan_transactions',
    {
      title: 'Get Orphan Transactions',
      description: 'Returns transactions with no invoice linkage (invoiceid=0). Optionally filter by client.',
      inputSchema: {
        clientId: { type: 'number', description: 'Optional client ID filter' },
      },
    },
    async ({ clientId }: { clientId?: number }) => {
      try { return ok(await deps.invoices.getOrphanTransactions(clientId ? { clientid: clientId } : {})); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_credit_history',
    {
      title: 'Get Credit History',
      description: 'Returns credit applications and refunds for a client (WHMCS 7.1+).',
      inputSchema: {
        clientId: { type: 'number', description: 'The WHMCS client ID' },
      },
    },
    async ({ clientId }: { clientId: number }) => {
      try { return ok(await deps.invoices.getCreditHistory(clientId, deps.capabilities)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_dunning_log',
    {
      title: 'Get Dunning Log',
      description: 'Returns payment reminders, failed-attempt entries, and invoice lifecycle events from the activity log.',
      inputSchema: {
        invoiceId: { type: 'number', description: 'The WHMCS invoice ID' },
        limit: { type: 'number', description: 'Max entries (default 100)' },
      },
    },
    async ({ invoiceId, limit }: { invoiceId: number; limit?: number }) => {
      try { return ok(await deps.invoices.getDunningLog(invoiceId, { limit })); }
      catch (e) { return fail((e as Error).message); }
    },
  );
}
