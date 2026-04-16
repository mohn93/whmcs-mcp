# Phase 7: Composite Investigative Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 pre-built investigative prompt templates that guide the LLM through multi-step diagnostic chains using tools built in Phases 1-3. These prompts encode the ops manager's investigation playbooks so they can type "investigate service 1001" and the LLM knows which tools to call and in what order.

**Architecture:** Add prompt registrations in `src/mcp/prompts/investigate.ts`. These are MCP **prompts** (not tools) — they return a message that instructs the LLM which tools to use. No new API calls needed; prompts compose existing tools. Uses the existing `server.registerPrompt()` API with zod schemas, same pattern as the 8 existing prompts in `src/index.ts`.

**Tech Stack:** TypeScript 5, zod, `@modelcontextprotocol/sdk`.

---

## File Structure

```
src/
  mcp/
    prompts/
      investigate.ts        # NEW — 4 investigative prompt registrations
  index.ts                  # MODIFY — wire prompts
test/
  unit/
    mcp/prompts/
      investigate.test.ts   # NEW — registration + output tests
```

---

## Task 1: Create investigative prompts module

**Files:**
- Create: `src/mcp/prompts/investigate.ts`
- Create: `test/unit/mcp/prompts/investigate.test.ts`

- [ ] **Step 1: Check existing prompt registration pattern**

Run: `grep -A 30 "server.registerPrompt" src/index.ts | head -40`

Note the API: `server.registerPrompt(name, { title, description, argsSchema }, handler)`. The handler receives args and returns `{ messages: [{ role: 'user', content: { type: 'text', text: '...' } }] }`. `argsSchema` uses zod.

- [ ] **Step 2: Write failing test**

Create `test/unit/mcp/prompts/investigate.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { registerInvestigativePrompts } from '../../../../src/mcp/prompts/investigate';

type PromptHandler = (args: Record<string, string>) => { messages: Array<{ role: string; content: { type: string; text: string } }> };

function makeServer() {
  const handlers: Record<string, PromptHandler> = {};
  const mcp = {
    registerPrompt: vi.fn((name: string, _schema: unknown, handler: PromptHandler) => {
      handlers[name] = handler;
    }),
  };
  return { mcp, handlers };
}

describe('registerInvestigativePrompts', () => {
  it('registers 4 investigative prompts', () => {
    const { mcp } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const names = mcp.registerPrompt.mock.calls.map((c: any) => c[0]);
    expect(names).toHaveLength(4);
    expect(names).toContain('investigate-service');
    expect(names).toContain('investigate-invoice');
    expect(names).toContain('client-incident-triage');
    expect(names).toContain('audit-product');
  });

  it('investigate-service prompt instructs to use provisioning tools', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['investigate-service']({ serviceId: '1001' });
    const text = result.messages[0].content.text;
    expect(text).toContain('1001');
    expect(text).toContain('whmcs_get_service_details');
    expect(text).toContain('whmcs_get_module_log');
  });

  it('investigate-invoice prompt instructs to use invoice tools', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['investigate-invoice']({ invoiceId: '5001' });
    const text = result.messages[0].content.text;
    expect(text).toContain('5001');
    expect(text).toContain('whmcs_get_invoice_audit');
    expect(text).toContain('whmcs_get_payment_attempts');
  });

  it('client-incident-triage prompt instructs to use timeline', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['client-incident-triage']({ clientId: '42' });
    const text = result.messages[0].content.text;
    expect(text).toContain('42');
    expect(text).toContain('whmcs_get_client_timeline');
  });

  it('audit-product prompt references product and server tools', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['audit-product']({ productId: '5' });
    const text = result.messages[0].content.text;
    expect(text).toContain('5');
    expect(text).toContain('whmcs_get_server_usage');
  });
});
```

- [ ] **Step 3: Run, confirm failure**

Run: `npm test -- mcp/prompts`
Expected: module not found.

- [ ] **Step 4: Implement the prompts module**

Create `src/mcp/prompts/investigate.ts`:
```typescript
import { z } from 'zod';

export function registerInvestigativePrompts(server: any): void {
  server.registerPrompt(
    'investigate-service',
    {
      title: 'Investigate Service',
      description: 'Diagnose why a hosting service is broken, not provisioning, or misconfigured. Walks through provisioning forensics tools.',
      argsSchema: {
        serviceId: z.string().describe('The WHMCS service/product ID to investigate'),
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
      description: 'Diagnose why an invoice is unpaid, has wrong amounts, or has payment issues. Walks through invoice forensics tools.',
      argsSchema: {
        invoiceId: z.string().describe('The WHMCS invoice ID to investigate'),
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
      description: 'Full diagnostic of a client account — timeline, open tickets, overdue invoices, failing services. The go-to prompt when a client calls in with a complaint.',
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
      description: 'Review a hosting product\'s configuration, pricing, and provisioning setup. Useful for checking if a product is correctly configured before selling.',
      argsSchema: {
        productId: z.string().describe('The WHMCS product ID to audit'),
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
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm test -- mcp/prompts`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/prompts/investigate.ts test/unit/mcp/prompts/investigate.test.ts
git commit -m "feat(mcp): add 4 investigative prompt templates"
```

---

## Task 2: Wire prompts into entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add import**

```typescript
import { registerInvestigativePrompts } from './mcp/prompts/investigate.js';
```

- [ ] **Step 2: Wire registration**

After the tool registrations (after `registerTimelineTools(...)`), add:
```typescript
registerInvestigativePrompts(server);
```

- [ ] **Step 3: Build, test, smoke**

Run: `npm run build && npm test` and smoke-boot.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire investigative prompts into entrypoint"
```

---

## Task 3: Documentation + verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/API_REFERENCE.md`

- [ ] **Step 1: Update CHANGELOG**

Under `## Unreleased > ### Added`, append:
```markdown
- `investigate-service` prompt — guided provisioning diagnostics chain
- `investigate-invoice` prompt — guided invoice/payment diagnostics chain
- `client-incident-triage` prompt — full client account diagnostic
- `audit-product` prompt — product configuration and provisioning audit
```

- [ ] **Step 2: Add "Investigative Prompts" section to API_REFERENCE**

Add a section listing the 4 prompts with their arguments and what tools they guide the LLM to use.

- [ ] **Step 3: Final verification**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`, smoke-boot. Report all results.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/API_REFERENCE.md
git commit -m "docs: document Phase 7 investigative prompts"
```

---

## Self-Review Results

- **Spec coverage:** all 4 prompts from the scoping doc (investigate-service, investigate-invoice, client-incident-triage, audit-product) are implemented + tested + wired + documented.
- **Placeholder scan:** all prompt texts are complete with specific tool names and step-by-step instructions.
- **Type consistency:** `registerInvestigativePrompts(server)` takes no deps (prompts are stateless text — they reference tool names, not tool implementations).
