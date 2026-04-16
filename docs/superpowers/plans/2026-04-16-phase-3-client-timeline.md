# Phase 3: Client 360 Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an ops manager a single-call chronological view of everything that happened for a client — orders, invoices, services, tickets, and domains — plus a one-click SSO login URL to jump into the client's admin view.

**Architecture:** Add a `timeline` domain to `src/whmcs/domains/` that aggregates data from multiple WHMCS API actions (`GetOrders`, `GetInvoices`, `GetClientsProducts`, `GetTickets`, `GetClientsDomains`, `CreateSsoToken`) into a unified, date-sorted timeline. Register 2 tools under `src/mcp/tools/timeline.ts`. `CreateSsoToken` is version-gated (7.7+) via capabilities.

**Tech Stack:** TypeScript 5, vitest, Node 18+, `@modelcontextprotocol/sdk`.

---

## File Structure

```
src/
  whmcs/
    domains/
      timeline.ts              # NEW — TimelineDomain class (2 methods)
  mcp/
    tools/
      timeline.ts              # NEW — tool registrations (2 tools)
  index.ts                     # MODIFY — wire TimelineDomain + tools
test/
  fixtures/
    GetOrders-client.json          # NEW
    GetInvoices-client.json        # NEW
    GetTickets-client.json         # NEW
    GetClientsDomains-client.json  # NEW
    CreateSsoToken.json            # NEW
  unit/
    whmcs/domains/timeline.test.ts # NEW
    mcp/tools/timeline.test.ts     # NEW
```

---

## Task 1: Create timeline fixtures

**Files:**
- Create: `test/fixtures/GetOrders-client.json`
- Create: `test/fixtures/GetInvoices-client.json`
- Create: `test/fixtures/GetTickets-client.json`
- Create: `test/fixtures/GetClientsDomains-client.json`
- Create: `test/fixtures/CreateSsoToken.json`

- [ ] **Step 1: Create `test/fixtures/GetOrders-client.json`**

```json
{
  "result": "success",
  "totalresults": 2,
  "startnumber": 0,
  "numreturned": 2,
  "orders": {
    "order": [
      {
        "id": 2001,
        "ordernum": 2001,
        "userid": 42,
        "date": "2025-01-15",
        "amount": "10.00",
        "paymentmethod": "stripe",
        "status": "Active"
      },
      {
        "id": 2002,
        "ordernum": 2002,
        "userid": 42,
        "date": "2025-06-01",
        "amount": "15.00",
        "paymentmethod": "stripe",
        "status": "Active"
      }
    ]
  }
}
```

- [ ] **Step 2: Create `test/fixtures/GetInvoices-client.json`**

```json
{
  "result": "success",
  "totalresults": 2,
  "startnumber": 0,
  "numreturned": 2,
  "invoices": {
    "invoice": [
      {
        "id": 5001,
        "userid": 42,
        "invoicenum": "5001",
        "date": "2026-01-01",
        "duedate": "2026-01-15",
        "datepaid": "0000-00-00 00:00:00",
        "total": "30.00",
        "status": "Unpaid",
        "paymentmethod": "stripe",
        "currencycode": "USD"
      },
      {
        "id": 5002,
        "userid": 42,
        "invoicenum": "5002",
        "date": "2025-12-01",
        "duedate": "2025-12-15",
        "datepaid": "2025-12-10 10:00:00",
        "total": "10.00",
        "status": "Paid",
        "paymentmethod": "stripe",
        "currencycode": "USD"
      }
    ]
  }
}
```

- [ ] **Step 3: Create `test/fixtures/GetTickets-client.json`**

```json
{
  "result": "success",
  "totalresults": 1,
  "startnumber": 0,
  "numreturned": 1,
  "tickets": {
    "ticket": [
      {
        "id": 8001,
        "tid": "TKT-8001",
        "userid": 42,
        "date": "2026-01-05 09:30:00",
        "deptname": "Support",
        "subject": "Cannot access cPanel",
        "status": "Open",
        "priority": "High",
        "lastreply": "2026-01-06 11:00:00"
      }
    ]
  }
}
```

- [ ] **Step 4: Create `test/fixtures/GetClientsDomains-client.json`**

```json
{
  "result": "success",
  "totalresults": 1,
  "startnumber": 0,
  "numreturned": 1,
  "domains": {
    "domain": [
      {
        "id": 301,
        "userid": 42,
        "domainname": "example.test",
        "regdate": "2025-01-15",
        "expirydate": "2026-01-15",
        "nextduedate": "2026-01-15",
        "registrar": "enom",
        "status": "Active"
      }
    ]
  }
}
```

- [ ] **Step 5: Create `test/fixtures/CreateSsoToken.json`**

```json
{
  "result": "success",
  "access_token": "sso_token_abc123",
  "redirect_url": "https://billing.example.com/admin/clientssummary.php?userid=42&token=sso_token_abc123"
}
```

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/GetOrders-client.json test/fixtures/GetInvoices-client.json test/fixtures/GetTickets-client.json test/fixtures/GetClientsDomains-client.json test/fixtures/CreateSsoToken.json
git commit -m "test: add client timeline fixtures"
```

---

## Task 2: `TimelineDomain.getClientTimeline`

**Files:**
- Create: `src/whmcs/domains/timeline.ts`
- Create: `test/unit/whmcs/domains/timeline.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/whmcs/domains/timeline.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { TimelineDomain } from '../../../../src/whmcs/domains/timeline';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import ordersFixture from '../../../fixtures/GetOrders-client.json';
import invoicesFixture from '../../../fixtures/GetInvoices-client.json';
import ticketsFixture from '../../../fixtures/GetTickets-client.json';
import domainsFixture from '../../../fixtures/GetClientsDomains-client.json';
import productsFixture from '../../../fixtures/GetClientsProducts-for-invoice.json';
import ssoFixture from '../../../fixtures/CreateSsoToken.json';

let server: MockWhmcsServer;
let timeline: TimelineDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetOrders: ordersFixture,
      GetInvoices: invoicesFixture,
      GetTickets: ticketsFixture,
      GetClientsDomains: domainsFixture,
      GetClientsProducts: productsFixture,
      CreateSsoToken: ssoFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  timeline = new TimelineDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('TimelineDomain.getClientTimeline', () => {
  it('merges events from all sources into a sorted timeline', async () => {
    const tl = await timeline.getClientTimeline(42);
    expect(tl.clientId).toBe(42);
    expect(tl.events.length).toBeGreaterThanOrEqual(7);
    // Should be sorted newest-first
    for (let i = 1; i < tl.events.length; i++) {
      expect(tl.events[i - 1].date >= tl.events[i].date).toBe(true);
    }
  });

  it('includes orders, invoices, services, tickets, and domains', async () => {
    const tl = await timeline.getClientTimeline(42);
    const types = new Set(tl.events.map((e) => e.type));
    expect(types).toContain('order');
    expect(types).toContain('invoice');
    expect(types).toContain('service');
    expect(types).toContain('ticket');
    expect(types).toContain('domain');
  });

  it('each event has type, date, summary, and id', async () => {
    const tl = await timeline.getClientTimeline(42);
    for (const event of tl.events) {
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('date');
      expect(event).toHaveProperty('summary');
      expect(event).toHaveProperty('id');
    }
  });

  it('summarizes events meaningfully', async () => {
    const tl = await timeline.getClientTimeline(42);
    const ticket = tl.events.find((e) => e.type === 'ticket')!;
    expect(ticket.summary).toContain('Cannot access cPanel');
    const invoice = tl.events.find((e) => e.type === 'invoice' && e.id === 5001)!;
    expect(invoice.summary).toContain('Unpaid');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

Create `src/whmcs/domains/timeline.ts`:
```typescript
import type { WhmcsClient } from '../client.js';

export interface TimelineEvent {
  type: 'order' | 'invoice' | 'service' | 'ticket' | 'domain';
  id: number;
  date: string;
  summary: string;
  status: string;
}

export interface ClientTimeline {
  clientId: number;
  events: TimelineEvent[];
}

export class TimelineDomain {
  constructor(private client: WhmcsClient) {}

  async getClientTimeline(clientId: number): Promise<ClientTimeline> {
    const [orders, invoices, products, tickets, domains] = await Promise.all([
      this.fetchOrders(clientId),
      this.fetchInvoices(clientId),
      this.fetchServices(clientId),
      this.fetchTickets(clientId),
      this.fetchDomains(clientId),
    ]);

    const events: TimelineEvent[] = [
      ...orders, ...invoices, ...products, ...tickets, ...domains,
    ];

    events.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

    return { clientId, events };
  }

  private async fetchOrders(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        orders: { order: Array<{ id: number; date: string; amount: string; status: string }> };
      }>('GetOrders', { userid: clientId });
      return (res.orders?.order ?? []).map((o) => ({
        type: 'order' as const,
        id: o.id,
        date: o.date,
        summary: `Order #${o.id} — $${o.amount} (${o.status})`,
        status: o.status,
      }));
    } catch { return []; }
  }

  private async fetchInvoices(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        invoices: { invoice: Array<{ id: number; date: string; total: string; status: string }> };
      }>('GetInvoices', { userid: clientId });
      return (res.invoices?.invoice ?? []).map((i) => ({
        type: 'invoice' as const,
        id: i.id,
        date: i.date,
        summary: `Invoice #${i.id} — $${i.total} (${i.status})`,
        status: i.status,
      }));
    } catch { return []; }
  }

  private async fetchServices(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        products: { product: Array<{ id: number; regdate: string; name: string; domain: string; status: string }> };
      }>('GetClientsProducts', { clientid: clientId });
      return (res.products?.product ?? []).map((p) => ({
        type: 'service' as const,
        id: p.id,
        date: p.regdate,
        summary: `${p.name} — ${p.domain} (${p.status})`,
        status: p.status,
      }));
    } catch { return []; }
  }

  private async fetchTickets(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        tickets: { ticket: Array<{ id: number; date: string; subject: string; status: string }> };
      }>('GetTickets', { clientid: clientId });
      return (res.tickets?.ticket ?? []).map((t) => ({
        type: 'ticket' as const,
        id: t.id,
        date: t.date,
        summary: `[${t.status}] ${t.subject}`,
        status: t.status,
      }));
    } catch { return []; }
  }

  private async fetchDomains(clientId: number): Promise<TimelineEvent[]> {
    try {
      const res = await this.client.call<{
        domains: { domain: Array<{ id: number; regdate: string; domainname: string; expirydate: string; status: string }> };
      }>('GetClientsDomains', { clientid: clientId });
      return (res.domains?.domain ?? []).map((d) => ({
        type: 'domain' as const,
        id: d.id,
        date: d.regdate,
        summary: `${d.domainname} — expires ${d.expirydate} (${d.status})`,
        status: d.status,
      }));
    } catch { return []; }
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/timeline`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/timeline.ts test/unit/whmcs/domains/timeline.test.ts
git commit -m "feat(timeline): getClientTimeline aggregating orders/invoices/services/tickets/domains"
```

---

## Task 3: `TimelineDomain.getClientAutoAuthUrl` (version-gated)

**Files:**
- Modify: `src/whmcs/domains/timeline.ts`
- Modify: `test/unit/whmcs/domains/timeline.test.ts`

- [ ] **Step 1: Add failing test**

Append:
```typescript
describe('TimelineDomain.getClientAutoAuthUrl', () => {
  it('returns SSO URL when capability is present', async () => {
    const result = await timeline.getClientAutoAuthUrl(42, { hasCreateSsoToken: true });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.redirectUrl).toContain('userid=42');
    }
  });

  it('reports unsupported when capability is missing', async () => {
    const result = await timeline.getClientAutoAuthUrl(42, { hasCreateSsoToken: false });
    expect(result.supported).toBe(false);
    if (!result.supported) {
      expect(result.reason).toMatch(/7\.7/);
    }
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

Add to `TimelineDomain`:
```typescript
async getClientAutoAuthUrl(
  clientId: number,
  caps: { hasCreateSsoToken: boolean },
): Promise<
  | { supported: true; redirectUrl: string; accessToken: string }
  | { supported: false; reason: string }
> {
  if (!caps.hasCreateSsoToken) {
    return {
      supported: false,
      reason: 'CreateSsoToken API action requires WHMCS 7.7 or later.',
    };
  }
  const res = await this.client.call<{
    access_token: string;
    redirect_url: string;
  }>('CreateSsoToken', { client_id: clientId });

  return {
    supported: true,
    redirectUrl: res.redirect_url,
    accessToken: res.access_token,
  };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/timeline`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/timeline.ts test/unit/whmcs/domains/timeline.test.ts
git commit -m "feat(timeline): getClientAutoAuthUrl with version gating"
```

---

## Task 4: MCP timeline tool registrations

**Files:**
- Create: `src/mcp/tools/timeline.ts`
- Create: `test/unit/mcp/tools/timeline.test.ts`

- [ ] **Step 1: Check registration pattern**

Run: `head -15 src/mcp/tools/invoices.ts`

- [ ] **Step 2: Write failing test**

Create `test/unit/mcp/tools/timeline.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { TimelineDomain } from '../../../../src/whmcs/domains/timeline';
import { registerTimelineTools } from '../../../../src/mcp/tools/timeline';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import ordersFixture from '../../../fixtures/GetOrders-client.json';
import invoicesFixture from '../../../fixtures/GetInvoices-client.json';
import ticketsFixture from '../../../fixtures/GetTickets-client.json';
import domainsFixture from '../../../fixtures/GetClientsDomains-client.json';
import productsFixture from '../../../fixtures/GetClientsProducts-for-invoice.json';
import ssoFixture from '../../../fixtures/CreateSsoToken.json';

type Handler = (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

let server: MockWhmcsServer;
let tl: TimelineDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetOrders: ordersFixture,
      GetInvoices: invoicesFixture,
      GetTickets: ticketsFixture,
      GetClientsDomains: domainsFixture,
      GetClientsProducts: productsFixture,
      CreateSsoToken: ssoFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  tl = new TimelineDomain(client);
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

describe('registerTimelineTools', () => {
  it('registers 2 timeline tools', () => {
    const { mcp } = makeServer();
    registerTimelineTools(mcp as never, {
      timeline: tl,
      capabilities: { hasCreateSsoToken: true } as never,
    });
    const names = mcp.registerTool.mock.calls.map((c: any) => c[0]);
    expect(names).toHaveLength(2);
    expect(names).toContain('whmcs_get_client_timeline');
    expect(names).toContain('whmcs_get_client_autoauth_url');
  });

  it('whmcs_get_client_timeline returns sorted events', async () => {
    const { mcp, handlers } = makeServer();
    registerTimelineTools(mcp as never, { timeline: tl, capabilities: { hasCreateSsoToken: true } as never });
    const out = await handlers['whmcs_get_client_timeline']({ clientId: 42 });
    expect(out.content[0].text).toContain('"events"');
    expect(out.content[0].text).toContain('"order"');
  });

  it('whmcs_get_client_autoauth_url surfaces unsupported state', async () => {
    const { mcp, handlers } = makeServer();
    registerTimelineTools(mcp as never, { timeline: tl, capabilities: { hasCreateSsoToken: false } as never });
    const out = await handlers['whmcs_get_client_autoauth_url']({ clientId: 42 });
    expect(out.content[0].text).toMatch(/7\.7/);
  });
});
```

- [ ] **Step 3: Run, confirm failure**

- [ ] **Step 4: Implement**

Create `src/mcp/tools/timeline.ts`:
```typescript
import type { TimelineDomain } from '../../whmcs/domains/timeline.js';
import type { Capabilities } from '../../whmcs/version.js';

export interface TimelineToolDeps {
  timeline: TimelineDomain;
  capabilities: Capabilities;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

export function registerTimelineTools(server: any, deps: TimelineToolDeps): void {
  server.registerTool(
    'whmcs_get_client_timeline',
    {
      title: 'Get Client Timeline',
      description: 'Returns a chronological timeline of all client events: orders, invoices, services, tickets, and domains — sorted newest-first.',
      inputSchema: {
        clientId: { type: 'number', description: 'The WHMCS client ID' },
      },
    },
    async ({ clientId }: { clientId: number }) => {
      try { return ok(await deps.timeline.getClientTimeline(clientId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_client_autoauth_url',
    {
      title: 'Get Client Auto-Auth URL',
      description: 'Returns a single-sign-on URL to log into the client area as this client (WHMCS 7.7+).',
      inputSchema: {
        clientId: { type: 'number', description: 'The WHMCS client ID' },
      },
    },
    async ({ clientId }: { clientId: number }) => {
      try { return ok(await deps.timeline.getClientAutoAuthUrl(clientId, deps.capabilities)); }
      catch (e) { return fail((e as Error).message); }
    },
  );
}
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm test -- mcp/tools/timeline`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/tools/timeline.ts test/unit/mcp/tools/timeline.test.ts
git commit -m "feat(mcp): client timeline tools (2 tools)"
```

---

## Task 5: Wire into entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add imports**

```typescript
import { TimelineDomain } from './whmcs/domains/timeline.js';
import { registerTimelineTools } from './mcp/tools/timeline.js';
```

- [ ] **Step 2: Wire registration**

After `registerInvoiceTools(...)`, add:
```typescript
registerTimelineTools(server, {
  timeline: new TimelineDomain(newClient),
  capabilities,
});
```

- [ ] **Step 3: Build, test, smoke**

Run: `npm run build && npm test && node -e "const {spawn}=require('child_process');const p=spawn('node',['dist/index.js'],{env:{...process.env,WHMCS_API_URL:'http://127.0.0.1:1/',WHMCS_API_IDENTIFIER:'x',WHMCS_API_SECRET:'y'}});setTimeout(()=>{console.log('alive=',!p.killed);p.kill();process.exit(0);},500);"`

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire client timeline domain into entrypoint"
```

---

## Task 6: Documentation + verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/API_REFERENCE.md`

- [ ] **Step 1: Update CHANGELOG**

Under `## Unreleased > ### Added`, append:
```markdown
- `whmcs_get_client_timeline` — chronological aggregation of orders/invoices/services/tickets/domains
- `whmcs_get_client_autoauth_url` — single-sign-on URL for client area (WHMCS 7.7+)
```

- [ ] **Step 2: Add "Client Timeline" section to API_REFERENCE**

- [ ] **Step 3: Final verification**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`, smoke-boot.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/API_REFERENCE.md
git commit -m "docs: document Phase 3 client timeline tools"
```

---

## Self-Review Results

- **Spec coverage:** both Phase 3 tools (client timeline, autoauth URL) + version gating.
- **Placeholder scan:** all code blocks complete.
- **Type consistency:** `TimelineEvent`, `ClientTimeline`, `TimelineDomain` used consistently.
