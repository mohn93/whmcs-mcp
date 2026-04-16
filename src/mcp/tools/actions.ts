import type { ActionDomain } from '../../whmcs/domains/actions.js';
import { requireMutations } from '../mutations.js';

export interface ActionToolDeps {
  actions: ActionDomain;
}

/**
 * Registers MCP tools for safe WHMCS actions (all mutation-gated).
 */
export function registerActionTools(server: any, deps: ActionToolDeps): void {
  server.registerTool(
    'whmcs_apply_credit',
    {
      title: 'Apply Credit to Invoice',
      description:
        'Applies a credit amount to an existing invoice. ' +
        'This is a MUTATING action — requires WHMCS_ALLOW_MUTATIONS=true and confirm: true.',
      inputSchema: {
        invoiceId: { type: 'number', description: 'The WHMCS invoice ID' },
        amount: { type: 'number', description: 'Credit amount to apply' },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm the mutating operation',
        },
      },
    },
    async ({ invoiceId, amount, confirm }: { invoiceId: number; amount: number; confirm?: boolean }) => {
      try {
        requireMutations('whmcs_apply_credit', confirm);
        const result = await deps.actions.applyCreditToInvoice(invoiceId, amount);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_resend_welcome_email',
    {
      title: 'Resend Welcome Email',
      description:
        'Re-sends the Product Welcome Email for a hosting service. ' +
        'This is a MUTATING action — requires WHMCS_ALLOW_MUTATIONS=true and confirm: true.',
      inputSchema: {
        serviceId: { type: 'number', description: 'The WHMCS service/product ID' },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm the mutating operation',
        },
      },
    },
    async ({ serviceId, confirm }: { serviceId: number; confirm?: boolean }) => {
      try {
        requireMutations('whmcs_resend_welcome_email', confirm);
        const result = await deps.actions.sendEmail({
          id: serviceId,
          messagename: 'Product Welcome Email',
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_send_invoice_reminder',
    {
      title: 'Send Invoice Reminder',
      description:
        'Sends an Invoice Payment Reminder email for the specified invoice. ' +
        'This is a MUTATING action — requires WHMCS_ALLOW_MUTATIONS=true and confirm: true.',
      inputSchema: {
        invoiceId: { type: 'number', description: 'The WHMCS invoice ID' },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm the mutating operation',
        },
      },
    },
    async ({ invoiceId, confirm }: { invoiceId: number; confirm?: boolean }) => {
      try {
        requireMutations('whmcs_send_invoice_reminder', confirm);
        const result = await deps.actions.sendEmail({
          id: invoiceId,
          messagename: 'Invoice Payment Reminder',
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_update_ticket_status',
    {
      title: 'Update Ticket Status',
      description:
        'Updates the status of a support ticket (e.g., Open, In Progress, Closed). ' +
        'This is a MUTATING action — requires WHMCS_ALLOW_MUTATIONS=true and confirm: true.',
      inputSchema: {
        ticketId: { type: 'number', description: 'The WHMCS ticket ID' },
        status: { type: 'string', description: 'New ticket status (e.g., Open, In Progress, Closed)' },
        message: { type: 'string', description: 'Optional message to add when updating the ticket' },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm the mutating operation',
        },
      },
    },
    async ({ ticketId, status, message, confirm }: { ticketId: number; status: string; message?: string; confirm?: boolean }) => {
      try {
        requireMutations('whmcs_update_ticket_status', confirm);
        const result = await deps.actions.updateTicketStatus(ticketId, status, message);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );
}
