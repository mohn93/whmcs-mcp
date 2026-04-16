import { z } from 'zod';

export function registerInvestigativePrompts(server: any): void {
  server.registerPrompt(
    'investigate-service',
    {
      title: 'Investigate Service',
      description:
        'Diagnose why a hosting service is broken, not provisioning, or misconfigured. Walks through provisioning forensics tools.',
      argsSchema: {
        serviceId: z
          .string()
          .describe('The WHMCS service/product ID to investigate'),
      },
    },
    ({ serviceId }: { serviceId: string }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Investigate why WHMCS service ID ${serviceId} is having issues. Follow this diagnostic chain:

1. **Get service state** — call \`whmcs_get_service_details\` with serviceId ${serviceId}. Check the status, assigned server, domain, and billing cycle.

2. **Check module command log** — call \`whmcs_get_module_log\` with serviceId ${serviceId}. Look for failed Create/Suspend/Unsuspend/Terminate attempts and their error messages.

3. **Check module queue** — call \`whmcs_get_module_queue\` to see if this service has pending/failed operations in the queue.

4. **Check server capacity** — call \`whmcs_get_server_usage\` to verify the assigned server isn't over capacity.

5. **Summarize findings** — based on the above data, explain:
   - What is the current state of the service?
   - What went wrong (root cause)?
   - What's the recommended fix?
   - Should we re-run a module command? (If yes, suggest \`whmcs_resync_service\` with the appropriate action.)`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'investigate-invoice',
    {
      title: 'Investigate Invoice',
      description:
        'Diagnose why an invoice is unpaid, has wrong amounts, or has payment issues. Walks through invoice forensics tools.',
      argsSchema: {
        invoiceId: z
          .string()
          .describe('The WHMCS invoice ID to investigate'),
      },
    },
    ({ invoiceId }: { invoiceId: string }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Investigate why WHMCS invoice #${invoiceId} has issues. Follow this diagnostic chain:

1. **Get invoice audit** — call \`whmcs_get_invoice_audit\` with invoiceId ${invoiceId}. Check each line item's origin (service-renewal, addon, manual), amounts, and linked services.

2. **Get payment attempts** — call \`whmcs_get_payment_attempts\` with invoiceId ${invoiceId}. Look at:
   - Successful transactions (amount, gateway, date)
   - Failed gateway attempts (error messages like "card declined", "insufficient funds")

3. **Check dunning log** — call \`whmcs_get_dunning_log\` with invoiceId ${invoiceId}. See what reminders were sent and when.

4. **Summarize findings** — based on the above data, explain:
   - What is the invoice for? (Break down each line item)
   - Why is it unpaid? (Payment failures? Never attempted? Wrong payment method?)
   - What's the recommended next step? (Retry payment, contact client, apply credit, etc.)`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'client-incident-triage',
    {
      title: 'Client Incident Triage',
      description:
        "Full diagnostic of a client account — timeline, open tickets, overdue invoices, failing services. The go-to prompt when a client calls in with a complaint.",
      argsSchema: {
        clientId: z.string().describe('The WHMCS client ID to triage'),
      },
    },
    ({ clientId }: { clientId: string }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Run a full incident triage for WHMCS client ID ${clientId}. Follow this diagnostic chain:

1. **Get client timeline** — call \`whmcs_get_client_timeline\` with clientId ${clientId}. Review the chronological view of orders, invoices, services, tickets, and domains.

2. **Identify red flags** — from the timeline, look for:
   - Open/overdue invoices
   - Services in Pending/Suspended/Terminated status
   - Open support tickets (especially high priority)
   - Recently expired domains

3. **Deep-dive on issues found** — for each red flag:
   - If an invoice is overdue: call \`whmcs_get_payment_attempts\` on it
   - If a service is failing: call \`whmcs_get_service_details\` + \`whmcs_get_module_log\` on it
   - If a ticket is open: note its subject and status for the summary

4. **Summarize** — provide a concise incident report:
   - Client's overall account health (good / at risk / critical)
   - List of active issues with severity
   - Recommended actions in priority order
   - Whether the client needs immediate attention or can be scheduled`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'audit-product',
    {
      title: 'Audit Product',
      description:
        "Review a hosting product's configuration, pricing, and provisioning setup. Useful for checking if a product is correctly configured before selling.",
      argsSchema: {
        productId: z
          .string()
          .describe('The WHMCS product ID to audit'),
      },
    },
    ({ productId }: { productId: string }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Audit WHMCS product ID ${productId}. Follow this diagnostic chain:

1. **Get product details** — call \`whmcs_get_products\` and find product ID ${productId}. Check name, group, pricing, billing cycles, and module assignment.

2. **Check server capacity** — call \`whmcs_get_server_usage\` to see which servers handle this product type and whether they have capacity.

3. **Check recent provisioning** — call \`whmcs_get_module_queue\` to see if there are failed provisioning attempts for this product's module type.

4. **Summarize** — provide an audit report:
   - Product configuration overview (name, pricing, module)
   - Server capacity status for the assigned server group
   - Any provisioning issues detected
   - Recommendations (is this product ready to sell? any configuration gaps?)`,
          },
        },
      ],
    }),
  );
}
