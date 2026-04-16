# Phase 2: Invoice & Payment Forensics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an ops manager the ability to investigate *why an invoice is unpaid or wrong* from within an LLM: pull enriched invoice line-items with origin classification, view all gateway payment attempts (successes + failures), find orphan transactions, trace client credit history, and review dunning/reminder emails sent.

**Architecture:** Add an `invoices` domain to `src/whmcs/domains/` backed by WHMCS API actions (`GetInvoice`, `GetTransactions`, `GetClientsProducts`, `GetActivityLog`, `GetEmails`). Register tools under `src/mcp/tools/invoices.ts`. All tools are read-only (no mutation gating needed this phase). The `WhmcsClient.call()` at `src/whmcs/client.ts` is the HTTP layer — domain methods call it directly with action names and params, exactly as `ProvisioningDomain` does.

**Tech Stack:** TypeScript 5, vitest, Node 18+, `@modelcontextprotocol/sdk`. Follows established patterns from Phase 0+1.

---

## File Structure

```
src/
  whmcs/
    domains/
      invoices.ts              # NEW — InvoiceDomain class (5 methods)
  mcp/
    tools/
      invoices.ts              # NEW — tool registrations (5 tools)
  index.ts                     # MODIFY — wire InvoiceDomain + tools
test/
  fixtures/
    GetInvoice-detailed.json           # NEW
    GetTransactions-invoice.json       # NEW
    GetTransactions-orphans.json       # NEW
    GetClientsProducts-for-invoice.json # NEW
    GetActivityLog-invoice.json        # NEW
  unit/
    whmcs/domains/invoices.test.ts     # NEW
    mcp/tools/invoices.test.ts         # NEW
```

---

## Task 1: Create invoice forensics fixtures

**Files:**
- Create: `test/fixtures/GetInvoice-detailed.json`
- Create: `test/fixtures/GetTransactions-invoice.json`
- Create: `test/fixtures/GetTransactions-orphans.json`
- Create: `test/fixtures/GetClientsProducts-for-invoice.json`
- Create: `test/fixtures/GetActivityLog-invoice.json`

- [ ] **Step 1: Create `test/fixtures/GetInvoice-detailed.json`**

```json
{
  "result": "success",
  "invoiceid": 5001,
  "invoicenum": "5001",
  "userid": 42,
  "date": "2026-01-01",
  "duedate": "2026-01-15",
  "datepaid": "0000-00-00 00:00:00",
  "status": "Unpaid",
  "paymentmethod": "stripe",
  "subtotal": "30.00",
  "credit": "0.00",
  "tax": "0.00",
  "tax2": "0.00",
  "total": "30.00",
  "balance": "30.00",
  "taxrate": "0.00",
  "taxrate2": "0.00",
  "currencycode": "USD",
  "currencyprefix": "$",
  "currencysuffix": "",
  "notes": "",
  "items": {
    "item": [
      {
        "id": 101,
        "type": "Hosting",
        "relid": 1001,
        "description": "Starter Hosting (01/01/2026 - 01/31/2026)",
        "amount": "10.00",
        "taxed": 0
      },
      {
        "id": 102,
        "type": "Hosting",
        "relid": 1002,
        "description": "Pro Hosting (01/01/2026 - 01/31/2026)",
        "amount": "15.00",
        "taxed": 0
      },
      {
        "id": 103,
        "type": "",
        "relid": 0,
        "description": "Setup Fee",
        "amount": "5.00",
        "taxed": 0
      }
    ]
  },
  "transactions": {
    "transaction": []
  }
}
```

- [ ] **Step 2: Create `test/fixtures/GetTransactions-invoice.json`**

```json
{
  "result": "success",
  "totalresults": 2,
  "startnumber": 0,
  "numreturned": 2,
  "transactions": {
    "transaction": [
      {
        "id": 3001,
        "userid": 42,
        "currency": 1,
        "gateway": "stripe",
        "date": "2026-01-10 14:30:00",
        "description": "Invoice Payment - Invoice #5001",
        "amountin": "20.00",
        "amountout": "0.00",
        "rate": "1.00000",
        "transid": "ch_abc123_failed",
        "invoiceid": 5001,
        "refundid": 0
      },
      {
        "id": 3002,
        "userid": 42,
        "currency": 1,
        "gateway": "stripe",
        "date": "2026-01-12 09:15:00",
        "description": "Invoice Payment - Invoice #5001",
        "amountin": "30.00",
        "amountout": "0.00",
        "rate": "1.00000",
        "transid": "ch_def456_success",
        "invoiceid": 5001,
        "refundid": 0
      }
    ]
  }
}
```

- [ ] **Step 3: Create `test/fixtures/GetTransactions-orphans.json`**

```json
{
  "result": "success",
  "totalresults": 1,
  "startnumber": 0,
  "numreturned": 1,
  "transactions": {
    "transaction": [
      {
        "id": 4001,
        "userid": 42,
        "currency": 1,
        "gateway": "paypal",
        "date": "2026-02-01 11:00:00",
        "description": "PayPal Payment - No invoice",
        "amountin": "50.00",
        "amountout": "0.00",
        "rate": "1.00000",
        "transid": "PP-orphan-789",
        "invoiceid": 0,
        "refundid": 0
      }
    ]
  }
}
```

- [ ] **Step 4: Create `test/fixtures/GetClientsProducts-for-invoice.json`**

```json
{
  "result": "success",
  "totalresults": 2,
  "products": {
    "product": [
      {
        "id": 1001,
        "clientid": 42,
        "orderid": 2001,
        "pid": 5,
        "regdate": "2025-01-15",
        "name": "Starter Hosting",
        "groupname": "Web Hosting",
        "domain": "example.test",
        "status": "Active",
        "nextduedate": "2026-02-01",
        "billingcycle": "Monthly",
        "recurringamount": "10.00"
      },
      {
        "id": 1002,
        "clientid": 42,
        "orderid": 2002,
        "pid": 6,
        "regdate": "2025-06-01",
        "name": "Pro Hosting",
        "groupname": "Web Hosting",
        "domain": "shop.test",
        "status": "Active",
        "nextduedate": "2026-02-01",
        "billingcycle": "Monthly",
        "recurringamount": "15.00"
      }
    ]
  }
}
```

- [ ] **Step 5: Create `test/fixtures/GetActivityLog-invoice.json`**

```json
{
  "result": "success",
  "totalresults": 3,
  "startnumber": 0,
  "numreturned": 3,
  "activity": {
    "entry": [
      { "date": "2026-01-15 09:00:00", "user": "System", "userid": 0, "description": "Invoice Payment Attempt Failed - Invoice #5001 - Gateway: stripe - Error: Card declined (insufficient funds)" },
      { "date": "2026-01-10 14:30:00", "user": "System", "userid": 0, "description": "Invoice Payment Attempt Failed - Invoice #5001 - Gateway: stripe - Error: Card expired" },
      { "date": "2026-01-01 00:01:00", "user": "System", "userid": 0, "description": "Invoice Created - Invoice #5001 for User ID: 42" }
    ]
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/GetInvoice-detailed.json test/fixtures/GetTransactions-invoice.json test/fixtures/GetTransactions-orphans.json test/fixtures/GetClientsProducts-for-invoice.json test/fixtures/GetActivityLog-invoice.json
git commit -m "test: add invoice forensics fixtures"
```

---

## Task 2: `InvoiceDomain.getInvoiceAudit`

**Files:**
- Create: `src/whmcs/domains/invoices.ts`
- Create: `test/unit/whmcs/domains/invoices.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/whmcs/domains/invoices.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- domains/invoices`
Expected: fail — module not found.

- [ ] **Step 3: Implement InvoiceDomain skeleton + getInvoiceAudit**

Create `src/whmcs/domains/invoices.ts`:
```typescript
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
        }>('GetClientsProducts', { clientid: res.userid });
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
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/invoices`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/invoices.ts test/unit/whmcs/domains/invoices.test.ts
git commit -m "feat(invoices): getInvoiceAudit with line-item origin classification"
```

---

## Task 3: `InvoiceDomain.getPaymentAttempts`

**Files:**
- Modify: `src/whmcs/domains/invoices.ts`
- Modify: `test/unit/whmcs/domains/invoices.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/unit/whmcs/domains/invoices.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement getPaymentAttempts**

Add to `InvoiceDomain`:
```typescript
export interface PaymentAttempts {
  invoiceid: number;
  transactions: Array<{
    id: number;
    gateway: string;
    date: string;
    description: string;
    amountin: string;
    amountout: string;
    transid: string;
    refundid: number;
  }>;
  failedAttempts: Array<{
    date: string;
    gateway: string;
    error: string;
  }>;
}
```

Add to the class:
```typescript
async getPaymentAttempts(invoiceId: number): Promise<PaymentAttempts> {
  const txRes = await this.client.call<{
    transactions: { transaction: Array<{
      id: number; gateway: string; date: string; description: string;
      amountin: string; amountout: string; transid: string;
      invoiceid: number; refundid: number;
    }> };
  }>('GetTransactions', { invoiceid: invoiceId });

  const transactions = (txRes.transactions?.transaction ?? []).map((t) => ({
    id: t.id,
    gateway: t.gateway,
    date: t.date,
    description: t.description,
    amountin: t.amountin,
    amountout: t.amountout,
    transid: t.transid,
    refundid: t.refundid,
  }));

  const actRes = await this.client.call<{
    activity: { entry: Array<{ date: string; description: string }> };
  }>('GetActivityLog', {
    description: `Invoice #${invoiceId}`,
    limitnum: 100,
  });

  const failedAttempts = (actRes.activity?.entry ?? [])
    .filter((e) => /Payment Attempt Failed/i.test(e.description) && e.description.includes(`#${invoiceId}`))
    .map((e) => {
      const gwMatch = /Gateway:\s*(\S+)/i.exec(e.description);
      const errMatch = /Error:\s*(.+)$/i.exec(e.description);
      return {
        date: e.date,
        gateway: gwMatch?.[1] ?? 'unknown',
        error: errMatch?.[1] ?? e.description,
      };
    });

  return { invoiceid: invoiceId, transactions, failedAttempts };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/invoices`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/invoices.ts test/unit/whmcs/domains/invoices.test.ts
git commit -m "feat(invoices): getPaymentAttempts with failed-attempt extraction"
```

---

## Task 4: `InvoiceDomain.getOrphanTransactions`

**Files:**
- Modify: `src/whmcs/domains/invoices.ts`
- Modify: `test/unit/whmcs/domains/invoices.test.ts`

- [ ] **Step 1: Add failing test**

Append:
```typescript
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
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

Add to `InvoiceDomain`:
```typescript
async getOrphanTransactions(options: { clientid?: number } = {}): Promise<
  Array<{
    id: number; gateway: string; date: string; description: string;
    amountin: string; amountout: string; transid: string;
    invoiceid: number; userid: number;
  }>
> {
  const res = await this.client.call<{
    transactions: { transaction: Array<{
      id: number; userid: number; gateway: string; date: string;
      description: string; amountin: string; amountout: string;
      transid: string; invoiceid: number;
    }> };
  }>('GetTransactions', options.clientid ? { clientid: options.clientid } : {});

  return (res.transactions?.transaction ?? [])
    .filter((t) => t.invoiceid === 0)
    .map((t) => ({
      id: t.id,
      gateway: t.gateway,
      date: t.date,
      description: t.description,
      amountin: t.amountin,
      amountout: t.amountout,
      transid: t.transid,
      invoiceid: t.invoiceid,
      userid: t.userid,
    }));
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/invoices`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/invoices.ts test/unit/whmcs/domains/invoices.test.ts
git commit -m "feat(invoices): getOrphanTransactions"
```

---

## Task 5: `InvoiceDomain.getCreditHistory` (version-gated)

**Files:**
- Modify: `src/whmcs/domains/invoices.ts`
- Modify: `test/unit/whmcs/domains/invoices.test.ts`
- Create: `test/fixtures/GetCredits.json`

- [ ] **Step 1: Create fixture**

Create `test/fixtures/GetCredits.json`:
```json
{
  "result": "success",
  "totalresults": 2,
  "credits": {
    "credit": [
      {
        "id": 601,
        "date": "2026-01-05",
        "description": "Credit Applied to Invoice #5001",
        "amount": "10.00",
        "relid": 5001
      },
      {
        "id": 602,
        "date": "2026-01-20",
        "description": "Refund for overpayment",
        "amount": "-5.00",
        "relid": 0
      }
    ]
  }
}
```

- [ ] **Step 2: Add failing test**

Append to `test/unit/whmcs/domains/invoices.test.ts` (add fixture import at top):

Add this import near the top with the other imports:
```typescript
import creditsFixture from '../../../fixtures/GetCredits.json';
```

Then append:
```typescript
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
});
```

- [ ] **Step 3: Run, confirm failure**

- [ ] **Step 4: Implement**

Add to `InvoiceDomain`:
```typescript
async getCreditHistory(
  clientId: number,
  caps: { hasGetCredits: boolean },
): Promise<
  | { supported: true; credits: Array<{
      id: number; date: string; description: string;
      amount: string; relid: number;
    }> }
  | { supported: false; reason: string }
> {
  if (!caps.hasGetCredits) {
    return {
      supported: false,
      reason: 'GetCredits API action requires WHMCS 7.1 or later.',
    };
  }
  const res = await this.client.call<{
    credits: { credit: Array<{
      id: number; date: string; description: string;
      amount: string; relid: number;
    }> };
  }>('GetCredits', { clientid: clientId });

  return {
    supported: true,
    credits: res.credits?.credit ?? [],
  };
}
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm test -- domains/invoices`
Expected: 11 passed.

- [ ] **Step 6: Commit**

```bash
git add src/whmcs/domains/invoices.ts test/unit/whmcs/domains/invoices.test.ts test/fixtures/GetCredits.json
git commit -m "feat(invoices): getCreditHistory with version gating"
```

---

## Task 6: `InvoiceDomain.getDunningLog`

**Files:**
- Modify: `src/whmcs/domains/invoices.ts`
- Modify: `test/unit/whmcs/domains/invoices.test.ts`

- [ ] **Step 1: Add failing test**

Append:
```typescript
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
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

Add to `InvoiceDomain`:
```typescript
async getDunningLog(
  invoiceId: number,
  options: { limit?: number } = {},
): Promise<Array<{ date: string; user: string; description: string }>> {
  const res = await this.client.call<{
    activity: { entry: Array<{ date: string; user: string; userid: number; description: string }> };
  }>('GetActivityLog', {
    description: `Invoice #${invoiceId}`,
    limitnum: options.limit ?? 100,
  });

  return (res.activity?.entry ?? [])
    .filter((e) => e.description.includes(`#${invoiceId}`))
    .map((e) => ({
      date: e.date,
      user: e.user,
      description: e.description,
    }));
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/invoices`
Expected: 13 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/invoices.ts test/unit/whmcs/domains/invoices.test.ts
git commit -m "feat(invoices): getDunningLog"
```

---

## Task 7: MCP invoice tool registrations

**Files:**
- Create: `src/mcp/tools/invoices.ts`
- Create: `test/unit/mcp/tools/invoices.test.ts`

- [ ] **Step 1: Check existing tool registration pattern**

Run: `head -20 src/mcp/tools/provisioning.ts`
Note the `server.registerTool()` call signature.

- [ ] **Step 2: Write failing test**

Create `test/unit/mcp/tools/invoices.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run, confirm failure**

- [ ] **Step 4: Implement**

Create `src/mcp/tools/invoices.ts`:
```typescript
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
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm test -- mcp/tools/invoices`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/tools/invoices.ts test/unit/mcp/tools/invoices.test.ts
git commit -m "feat(mcp): invoice forensics tools (5 tools)"
```

---

## Task 8: Wire into entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Read `src/index.ts` to find where provisioning tools are wired**

Run: `grep -n 'registerProvisioningTools\|InvoiceDomain\|registerInvoiceTools' src/index.ts`

- [ ] **Step 2: Add imports**

Near the existing Phase 1 imports, add:
```typescript
import { InvoiceDomain } from './whmcs/domains/invoices.js';
import { registerInvoiceTools } from './mcp/tools/invoices.js';
```

- [ ] **Step 3: Wire the registration**

After the `registerProvisioningTools(...)` call, add:
```typescript
registerInvoiceTools(server, {
  invoices: new InvoiceDomain(newClient),
  capabilities,
});
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 6: Smoke-boot**

Run:
```bash
node -e "const {spawn}=require('child_process');const p=spawn('node',['dist/index.js'],{env:{...process.env,WHMCS_API_URL:'http://127.0.0.1:1/',WHMCS_API_IDENTIFIER:'x',WHMCS_API_SECRET:'y'}});setTimeout(()=>{console.log('alive=',!p.killed);p.kill();process.exit(0);},500);"
```
Expected: `alive= true`.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire invoice forensics domain into entrypoint"
```

---

## Task 9: Documentation + changelog

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/API_REFERENCE.md`

- [ ] **Step 1: Update CHANGELOG.md**

Read `CHANGELOG.md`. Under `## Unreleased > ### Added`, append:
```markdown
- `whmcs_get_invoice_audit` — enriched invoice with line-item origin classification
- `whmcs_get_payment_attempts` — transactions + failed gateway attempts for an invoice
- `whmcs_get_orphan_transactions` — transactions with no invoice linkage
- `whmcs_get_credit_history` — credit applications/refunds per client (WHMCS 7.1+)
- `whmcs_get_dunning_log` — payment reminders and invoice lifecycle events
```

- [ ] **Step 2: Add docs to API_REFERENCE**

In `docs/API_REFERENCE.md`, add a new section **"Invoice & Payment Forensics"** listing the 5 new tools with parameters (modeled on the existing "Provisioning Forensics" section).

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md README.md docs/API_REFERENCE.md
git commit -m "docs: document Phase 2 invoice forensics tools"
```

---

## Task 10: Verification sweep

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 2: TypeScript no-emit check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Boot smoke-check**

Run:
```bash
node -e "const {spawn}=require('child_process');const p=spawn('node',['dist/index.js'],{env:{...process.env,WHMCS_API_URL:'http://127.0.0.1:1/',WHMCS_API_IDENTIFIER:'x',WHMCS_API_SECRET:'y'}});setTimeout(()=>{console.log('alive=',!p.killed);p.kill();process.exit(0);},500);"
```
Expected: `alive= true`.

- [ ] **Step 5: Git summary**

Run: `git log --oneline` and count Phase 2 commits. Verify clean tree.

---

## Self-Review Results

- **Spec coverage:** all 5 Phase 2 tools from the scoping doc (invoice audit, payment attempts, orphan transactions, credit history, dunning log) are implemented + tested + wired + documented.
- **Placeholder scan:** no TBDs; all test bodies and implementation bodies are concrete.
- **Type consistency:** `InvoiceDomain` methods return types match tool handlers. `Capabilities` from Phase 0 used consistently. `AuditLineItem`, `PaymentAttempts`, `InvoiceAudit` types used across domain + tests consistently.

## Completion Criteria

- All tests pass (`npm test`), ≥ 13 new assertions in invoice domain tests, 3+ in tool registration tests.
- `whmcs_get_credit_history` returns structured `{ supported: false, reason: ... }` on WHMCS < 7.1 instead of throwing.
- `whmcs_get_invoice_audit` classifies line items by origin and links service items to their service details.
- `whmcs_get_payment_attempts` extracts failed gateway attempts from the activity log.
- `dist/index.js` boots to stdio-ready state with all invoice tools registered.
- CHANGELOG + API_REFERENCE reflect the new tools.
