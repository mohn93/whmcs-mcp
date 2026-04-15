# Phase 1: Provisioning Forensics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Depends on Phase 0** (`2026-04-15-phase-0-foundations.md`). Do not start this plan until Phase 0 is merged.

**Goal:** Give an ops manager the ability to investigate *why a service isn't provisioning* from within an LLM: pull full service state, module command history, the module queue, force a retry (guarded), and see per-server capacity.

**Architecture:** Add a `provisioning` domain to `src/whmcs/domains/` backed by WHMCS API actions (`GetClientsProducts`, `GetActivityLog`, `ModuleQueue` — version-gated, `ModuleCustom`, `GetServers`). Register tools under `src/mcp/tools/provisioning.ts`. All mutating tools (just `whmcs_resync_service` this phase) require the `WHMCS_ALLOW_MUTATIONS=true` env flag **and** an explicit `confirm: true` param. Version-gated features use the `Capabilities` probe from Phase 0 and degrade gracefully.

**Tech Stack:** same as Phase 0 — TypeScript 5, vitest, Node 18+, `@modelcontextprotocol/sdk`.

---

## File Structure

```
src/
  whmcs/
    domains/
      provisioning.ts          # NEW — ProvisioningDomain class
  mcp/
    tools/
      provisioning.ts          # NEW — tool registrations
    capabilities.ts            # NEW — shared capability context wiring
    mutations.ts               # NEW — mutation-gating helper
  index.ts                     # MODIFY — wire in ProvisioningDomain + tools
test/
  fixtures/
    GetClientsProducts-service.json   # NEW
    GetActivityLog-service.json       # NEW
    ModuleQueue.json                  # NEW
    ModuleCustom-createAccount.json   # NEW
    GetServers-with-usage.json        # NEW
  unit/
    whmcs/domains/provisioning.test.ts # NEW
    mcp/tools/provisioning.test.ts     # NEW
    mcp/mutations.test.ts              # NEW
```

---

## Task 1: Mutation-gating helper

**Files:**
- Create: `src/mcp/mutations.ts`
- Create: `test/unit/mcp/mutations.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/mcp/mutations.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireMutations, mutationsEnabled } from '../../../src/mcp/mutations';

const ORIGINAL = process.env.WHMCS_ALLOW_MUTATIONS;

beforeEach(() => { delete process.env.WHMCS_ALLOW_MUTATIONS; });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.WHMCS_ALLOW_MUTATIONS;
  else process.env.WHMCS_ALLOW_MUTATIONS = ORIGINAL;
});

describe('mutation gating', () => {
  it('is disabled by default', () => {
    expect(mutationsEnabled()).toBe(false);
  });

  it('is enabled when env flag is exactly "true"', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(mutationsEnabled()).toBe(true);
  });

  it('is NOT enabled by "1", "yes", or other truthy strings', () => {
    for (const v of ['1', 'yes', 'TRUE', 'on']) {
      process.env.WHMCS_ALLOW_MUTATIONS = v;
      expect(mutationsEnabled()).toBe(false);
    }
  });

  it('requireMutations throws when disabled, with actionable message', () => {
    expect(() => requireMutations('whmcs_resync_service')).toThrow(/WHMCS_ALLOW_MUTATIONS/);
  });

  it('requireMutations throws when confirm is not true', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(() => requireMutations('whmcs_resync_service', false)).toThrow(/confirm: true/);
  });

  it('requireMutations passes when enabled and confirmed', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(() => requireMutations('whmcs_resync_service', true)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- mcp/mutations`
Expected: module not found.

- [ ] **Step 3: Implement the helper**

Create `src/mcp/mutations.ts`:
```typescript
export function mutationsEnabled(): boolean {
  return process.env.WHMCS_ALLOW_MUTATIONS === 'true';
}

export function requireMutations(toolName: string, confirm?: boolean): void {
  if (!mutationsEnabled()) {
    throw new Error(
      `${toolName} is a mutating tool and is disabled. Set WHMCS_ALLOW_MUTATIONS=true in the server environment to enable.`,
    );
  }
  if (confirm !== true) {
    throw new Error(
      `${toolName} requires explicit confirm: true in the call parameters to run.`,
    );
  }
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `npm test -- mcp/mutations`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/mutations.ts test/unit/mcp/mutations.test.ts
git commit -m "feat(mcp): mutation-gating helper (env flag + confirm param)"
```

---

## Task 2: Capture fixtures (offline — handcrafted from API docs)

**Files:**
- Create: `test/fixtures/GetClientsProducts-service.json`
- Create: `test/fixtures/GetActivityLog-service.json`
- Create: `test/fixtures/ModuleQueue.json`
- Create: `test/fixtures/ModuleCustom-createAccount.json`
- Create: `test/fixtures/GetServers-with-usage.json`

> These are synthetic fixtures shaped per the WHMCS API docs. Once live access is available, re-capture via `npm run capture -- <Action> ...` (built in Phase 0 Task 8) to replace them with anonymized real data.

- [ ] **Step 1: Create `GetClientsProducts-service.json`**

```json
{
  "result": "success",
  "clientid": 42,
  "totalresults": 1,
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
        "dedicatedip": "",
        "serverid": 3,
        "servername": "node-01",
        "serverip": "10.0.0.3",
        "serverhostname": "node-01.hosting.local",
        "status": "Pending",
        "nextduedate": "2026-01-15",
        "paymentmethod": "stripe",
        "firstpaymentamount": "10.00",
        "recurringamount": "10.00",
        "billingcycle": "Monthly",
        "customfields": { "customfield": [] },
        "configoptions": { "configoption": [] },
        "username": "expl1234",
        "password": "REDACTED",
        "notes": ""
      }
    ]
  }
}
```

- [ ] **Step 2: Create `GetActivityLog-service.json`**

```json
{
  "result": "success",
  "totalresults": 3,
  "startnumber": 0,
  "numreturned": 3,
  "activity": {
    "entry": [
      { "date": "2025-01-15 10:02:03", "user": "System", "userid": 0, "description": "Module Create Failed for Service ID 1001 - Error: Account creation failed: domain already exists" },
      { "date": "2025-01-15 10:01:58", "user": "System", "userid": 0, "description": "Module Create Command Initiated for Service ID 1001" },
      { "date": "2025-01-15 10:01:55", "user": "admin",  "userid": 1, "description": "Order 2001 accepted" }
    ]
  }
}
```

- [ ] **Step 3: Create `ModuleQueue.json`**

```json
{
  "result": "success",
  "totalresults": 1,
  "queue": {
    "item": [
      {
        "id": 77,
        "service_type": "Hosting",
        "service_id": 1001,
        "module": "cpanel",
        "action": "Create",
        "related_id": 2001,
        "last_attempt": "2025-01-15 10:02:03",
        "last_attempt_error": "Account creation failed: domain already exists"
      }
    ]
  }
}
```

- [ ] **Step 4: Create `ModuleCustom-createAccount.json`**

```json
{
  "result": "success",
  "message": "CreateAccount command ran successfully"
}
```

- [ ] **Step 5: Create `GetServers-with-usage.json`**

```json
{
  "result": "success",
  "totalresults": 2,
  "servers": [
    {
      "id": 3,
      "name": "node-01",
      "hostname": "node-01.hosting.local",
      "ipaddress": "10.0.0.3",
      "monthlycost": "120.00",
      "noofservices": 85,
      "maxallowedservices": 200,
      "percentused": 42,
      "activestatus": true,
      "module": "cpanel"
    },
    {
      "id": 4,
      "name": "node-02",
      "hostname": "node-02.hosting.local",
      "ipaddress": "10.0.0.4",
      "monthlycost": "120.00",
      "noofservices": 195,
      "maxallowedservices": 200,
      "percentused": 97,
      "activestatus": true,
      "module": "cpanel"
    }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/GetClientsProducts-service.json test/fixtures/GetActivityLog-service.json test/fixtures/ModuleQueue.json test/fixtures/ModuleCustom-createAccount.json test/fixtures/GetServers-with-usage.json
git commit -m "test: add provisioning forensics fixtures"
```

---

## Task 3: `ProvisioningDomain.getServiceDetails`

**Files:**
- Create: `src/whmcs/domains/provisioning.ts`
- Create: `test/unit/whmcs/domains/provisioning.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/whmcs/domains/provisioning.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ProvisioningDomain } from '../../../../src/whmcs/domains/provisioning';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import productFixture from '../../../fixtures/GetClientsProducts-service.json';
import activityFixture from '../../../fixtures/GetActivityLog-service.json';
import moduleQueueFixture from '../../../fixtures/ModuleQueue.json';
import serversFixture from '../../../fixtures/GetServers-with-usage.json';
import moduleCustomFixture from '../../../fixtures/ModuleCustom-createAccount.json';

let server: MockWhmcsServer;
let prov: ProvisioningDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetClientsProducts: productFixture,
      GetActivityLog: activityFixture,
      ModuleQueue: moduleQueueFixture,
      GetServers: serversFixture,
      ModuleCustom: moduleCustomFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  prov = new ProvisioningDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('ProvisioningDomain.getServiceDetails', () => {
  it('returns enriched single-service record', async () => {
    const svc = await prov.getServiceDetails(1001);
    expect(svc.id).toBe(1001);
    expect(svc.status).toBe('Pending');
    expect(svc.domain).toBe('example.test');
    expect(svc.server?.name).toBe('node-01');
    expect(svc.nextduedate).toBe('2026-01-15');
  });

  it('sends serviceid filter to WHMCS', async () => {
    await prov.getServiceDetails(1001);
    expect(server.lastRequest()?.params.get('action')).toBe('GetClientsProducts');
    expect(server.lastRequest()?.params.get('serviceid')).toBe('1001');
  });

  it('throws a useful error when service is not found', async () => {
    server.setFixture('GetClientsProducts', {
      result: 'success', totalresults: 0, products: { product: [] },
    });
    await expect(prov.getServiceDetails(9999)).rejects.toThrow(/Service 9999 not found/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- domains/provisioning`
Expected: module not found.

- [ ] **Step 3: Implement `ProvisioningDomain` skeleton + `getServiceDetails`**

Create `src/whmcs/domains/provisioning.ts`:
```typescript
import type { WhmcsClient } from '../client.js';

export interface ServiceDetails {
  id: number;
  clientid: number;
  orderid: number;
  pid: number;
  name: string;
  groupname: string;
  domain: string;
  status: string;
  regdate: string;
  nextduedate: string;
  billingcycle: string;
  recurringamount: string;
  paymentmethod: string;
  server?: {
    id: number;
    name: string;
    hostname: string;
    ip: string;
  };
  username: string;
}

interface RawProduct {
  id: number; clientid: number; orderid: number; pid: number;
  name: string; groupname: string; domain: string; status: string;
  regdate: string; nextduedate: string; billingcycle: string;
  recurringamount: string; paymentmethod: string;
  serverid: number; servername: string; serverhostname: string; serverip: string;
  username: string;
}

export class ProvisioningDomain {
  constructor(private client: WhmcsClient) {}

  async getServiceDetails(serviceId: number): Promise<ServiceDetails> {
    const res = await this.client.call<{
      totalresults: number;
      products: { product: RawProduct[] };
    }>('GetClientsProducts', { serviceid: serviceId });

    const product = res.products?.product?.[0];
    if (!product) {
      throw new Error(`Service ${serviceId} not found`);
    }
    return {
      id: product.id,
      clientid: product.clientid,
      orderid: product.orderid,
      pid: product.pid,
      name: product.name,
      groupname: product.groupname,
      domain: product.domain,
      status: product.status,
      regdate: product.regdate,
      nextduedate: product.nextduedate,
      billingcycle: product.billingcycle,
      recurringamount: product.recurringamount,
      paymentmethod: product.paymentmethod,
      username: product.username,
      server: product.serverid
        ? {
            id: product.serverid,
            name: product.servername,
            hostname: product.serverhostname,
            ip: product.serverip,
          }
        : undefined,
    };
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/provisioning`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/provisioning.ts test/unit/whmcs/domains/provisioning.test.ts
git commit -m "feat(provisioning): getServiceDetails"
```

---

## Task 4: `ProvisioningDomain.getModuleLog`

**Files:**
- Modify: `src/whmcs/domains/provisioning.ts`
- Modify: `test/unit/whmcs/domains/provisioning.test.ts`

- [ ] **Step 1: Add failing test inside the existing describe block**

Append to `test/unit/whmcs/domains/provisioning.test.ts` (before the final `});`):
```typescript
describe('ProvisioningDomain.getModuleLog', () => {
  it('returns only activity-log entries related to the given service ID', async () => {
    const log = await prov.getModuleLog(1001);
    expect(log).toHaveLength(2);
    expect(log[0].description).toMatch(/Module Create Failed/);
    expect(log[1].description).toMatch(/Module Create Command Initiated/);
    expect(log.every((e) => /1001/.test(e.description))).toBe(true);
  });

  it('passes a narrowing description filter to the WHMCS API', async () => {
    await prov.getModuleLog(1001);
    expect(server.lastRequest()?.params.get('action')).toBe('GetActivityLog');
    expect(server.lastRequest()?.params.get('description')).toContain('1001');
  });

  it('honors the limit parameter', async () => {
    await prov.getModuleLog(1001, { limit: 5 });
    expect(server.lastRequest()?.params.get('limitnum')).toBe('5');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- domains/provisioning`
Expected: new tests fail — `getModuleLog` undefined.

- [ ] **Step 3: Implement `getModuleLog`**

Add to `src/whmcs/domains/provisioning.ts` inside the `ProvisioningDomain` class:
```typescript
async getModuleLog(
  serviceId: number,
  options: { limit?: number } = {},
): Promise<Array<{ date: string; user: string; userid: number; description: string }>> {
  const res = await this.client.call<{
    activity: { entry: Array<{ date: string; user: string; userid: number; description: string }> };
  }>('GetActivityLog', {
    description: `Service ID ${serviceId}`,
    limitnum: options.limit ?? 50,
  });
  const entries = res.activity?.entry ?? [];
  return entries.filter((e) =>
    new RegExp(`\\b(Service ID ${serviceId}|Service #${serviceId}|service ${serviceId})\\b`, 'i').test(
      e.description,
    ) || /Module /i.test(e.description),
  );
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/provisioning`
Expected: 6 passed total in file.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/provisioning.ts test/unit/whmcs/domains/provisioning.test.ts
git commit -m "feat(provisioning): getModuleLog"
```

---

## Task 5: `ProvisioningDomain.getModuleQueue` with version gating

**Files:**
- Modify: `src/whmcs/domains/provisioning.ts`
- Modify: `test/unit/whmcs/domains/provisioning.test.ts`

- [ ] **Step 1: Add failing test**

Append to `test/unit/whmcs/domains/provisioning.test.ts`:
```typescript
describe('ProvisioningDomain.getModuleQueue', () => {
  it('returns entries when capability is present', async () => {
    const caps = { hasModuleQueue: true } as const;
    const q = await prov.getModuleQueue(caps);
    expect(q.supported).toBe(true);
    if (q.supported) {
      expect(q.items).toHaveLength(1);
      expect(q.items[0].service_id).toBe(1001);
      expect(q.items[0].last_attempt_error).toMatch(/domain already exists/);
    }
  });

  it('reports unsupported when capability is missing', async () => {
    const caps = { hasModuleQueue: false } as const;
    const q = await prov.getModuleQueue(caps);
    expect(q.supported).toBe(false);
    if (!q.supported) {
      expect(q.reason).toMatch(/WHMCS.*8/);
    }
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- domains/provisioning`
Expected: new tests fail.

- [ ] **Step 3: Implement `getModuleQueue`**

Add to `ProvisioningDomain`:
```typescript
async getModuleQueue(caps: { hasModuleQueue: boolean }): Promise<
  | { supported: true; items: Array<{
      id: number; service_type: string; service_id: number;
      module: string; action: string; related_id: number;
      last_attempt: string; last_attempt_error: string;
    }> }
  | { supported: false; reason: string }
> {
  if (!caps.hasModuleQueue) {
    return {
      supported: false,
      reason: 'ModuleQueue API action requires WHMCS 8.0 or later.',
    };
  }
  const res = await this.client.call<{
    queue: { item: Array<{
      id: number; service_type: string; service_id: number;
      module: string; action: string; related_id: number;
      last_attempt: string; last_attempt_error: string;
    }> };
  }>('ModuleQueue');
  return { supported: true, items: res.queue?.item ?? [] };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/provisioning`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/provisioning.ts test/unit/whmcs/domains/provisioning.test.ts
git commit -m "feat(provisioning): getModuleQueue with version gating"
```

---

## Task 6: `ProvisioningDomain.getServerUsage`

**Files:**
- Modify: `src/whmcs/domains/provisioning.ts`
- Modify: `test/unit/whmcs/domains/provisioning.test.ts`

- [ ] **Step 1: Add failing test**

Append:
```typescript
describe('ProvisioningDomain.getServerUsage', () => {
  it('returns per-server utilization including headroom', async () => {
    const u = await prov.getServerUsage();
    expect(u).toHaveLength(2);
    const node01 = u.find((s) => s.name === 'node-01')!;
    expect(node01.used).toBe(85);
    expect(node01.capacity).toBe(200);
    expect(node01.percentUsed).toBe(42);
    expect(node01.headroom).toBe(115);
    expect(node01.module).toBe('cpanel');
  });

  it('flags servers over 90% utilization', async () => {
    const u = await prov.getServerUsage();
    const hot = u.filter((s) => s.percentUsed >= 90);
    expect(hot).toHaveLength(1);
    expect(hot[0].name).toBe('node-02');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- domains/provisioning`
Expected: new tests fail.

- [ ] **Step 3: Implement `getServerUsage`**

Add to `ProvisioningDomain`:
```typescript
async getServerUsage(): Promise<
  Array<{
    id: number; name: string; hostname: string; ip: string;
    module: string; active: boolean;
    used: number; capacity: number; percentUsed: number; headroom: number;
  }>
> {
  const res = await this.client.call<{
    servers: Array<{
      id: number; name: string; hostname: string; ipaddress: string;
      noofservices: number; maxallowedservices: number; percentused: number;
      activestatus: boolean; module: string;
    }>;
  }>('GetServers');

  return (res.servers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    hostname: s.hostname,
    ip: s.ipaddress,
    module: s.module,
    active: s.activestatus,
    used: s.noofservices,
    capacity: s.maxallowedservices,
    percentUsed: s.percentused,
    headroom: Math.max(0, s.maxallowedservices - s.noofservices),
  }));
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/provisioning`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/provisioning.ts test/unit/whmcs/domains/provisioning.test.ts
git commit -m "feat(provisioning): getServerUsage"
```

---

## Task 7: `ProvisioningDomain.resyncService` (guarded mutation)

**Files:**
- Modify: `src/whmcs/domains/provisioning.ts`
- Modify: `test/unit/whmcs/domains/provisioning.test.ts`

> This method re-runs the last failed module action via `ModuleCustom`. Guarding (env + confirm) is enforced at the *tool layer* in Task 8. The domain method itself is a thin API wrapper; keeping business-layer guards out of the domain keeps it unit-testable without env manipulation.

- [ ] **Step 1: Add failing test**

Append:
```typescript
describe('ProvisioningDomain.resyncService', () => {
  it('issues a ModuleCreate call for the given service', async () => {
    const r = await prov.resyncService(1001, 'Create');
    expect(r.message).toMatch(/successfully/i);
    const last = server.lastRequest()!;
    expect(last.params.get('action')).toBe('ModuleCustom');
    expect(last.params.get('serviceid')).toBe('1001');
    expect(last.params.get('func_name')).toBe('Create');
  });

  it('defaults to Create when no action is provided', async () => {
    await prov.resyncService(1001);
    expect(server.lastRequest()!.params.get('func_name')).toBe('Create');
  });

  it('rejects unsupported actions', async () => {
    await expect(prov.resyncService(1001, 'DropTables' as never)).rejects.toThrow(/unsupported/i);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- domains/provisioning`
Expected: fails — `resyncService` undefined.

- [ ] **Step 3: Implement**

Add to `ProvisioningDomain`:
```typescript
type ModuleAction = 'Create' | 'Suspend' | 'Unsuspend' | 'Terminate' | 'ChangePackage' | 'ChangePassword';

private static readonly SUPPORTED_ACTIONS: ReadonlySet<ModuleAction> = new Set([
  'Create', 'Suspend', 'Unsuspend', 'Terminate', 'ChangePackage', 'ChangePassword',
]);

async resyncService(
  serviceId: number,
  action: ModuleAction = 'Create',
): Promise<{ message: string }> {
  if (!ProvisioningDomain.SUPPORTED_ACTIONS.has(action)) {
    throw new Error(`Unsupported module action: ${action}`);
  }
  const res = await this.client.call<{ message: string }>('ModuleCustom', {
    serviceid: serviceId,
    func_name: action,
  });
  return { message: res.message ?? 'OK' };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- domains/provisioning`
Expected: 13 passed.

- [ ] **Step 5: Commit**

```bash
git add src/whmcs/domains/provisioning.ts test/unit/whmcs/domains/provisioning.test.ts
git commit -m "feat(provisioning): resyncService (domain layer, unguarded)"
```

---

## Task 8: MCP tool registrations

**Files:**
- Create: `src/mcp/tools/provisioning.ts`
- Create: `test/unit/mcp/tools/provisioning.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/unit/mcp/tools/provisioning.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ProvisioningDomain } from '../../../../src/whmcs/domains/provisioning';
import { registerProvisioningTools } from '../../../../src/mcp/tools/provisioning';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import productFixture from '../../../fixtures/GetClientsProducts-service.json';
import activityFixture from '../../../fixtures/GetActivityLog-service.json';
import moduleQueueFixture from '../../../fixtures/ModuleQueue.json';
import serversFixture from '../../../fixtures/GetServers-with-usage.json';
import moduleCustomFixture from '../../../fixtures/ModuleCustom-createAccount.json';

type Handler = (args: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

let server: MockWhmcsServer;
let prov: ProvisioningDomain;
const ORIGINAL = process.env.WHMCS_ALLOW_MUTATIONS;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetClientsProducts: productFixture,
      GetActivityLog: activityFixture,
      ModuleQueue: moduleQueueFixture,
      GetServers: serversFixture,
      ModuleCustom: moduleCustomFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  prov = new ProvisioningDomain(client);
});
afterAll(async () => { await server.stop(); });

beforeEach(() => { delete process.env.WHMCS_ALLOW_MUTATIONS; });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.WHMCS_ALLOW_MUTATIONS;
  else process.env.WHMCS_ALLOW_MUTATIONS = ORIGINAL;
});

function makeServer() {
  const handlers: Record<string, Handler> = {};
  const mcp = {
    registerTool: vi.fn((name: string, _schema: unknown, handler: Handler) => {
      handlers[name] = handler;
    }),
  };
  return { mcp, handlers };
}

describe('registerProvisioningTools', () => {
  it('registers the expected tool names', () => {
    const { mcp } = makeServer();
    registerProvisioningTools(mcp as never, {
      provisioning: prov,
      capabilities: { hasModuleQueue: true } as never,
    });
    const names = mcp.registerTool.mock.calls.map((c) => c[0]);
    expect(names).toEqual(
      expect.arrayContaining([
        'whmcs_get_service_details',
        'whmcs_get_module_log',
        'whmcs_get_module_queue',
        'whmcs_get_server_usage',
        'whmcs_resync_service',
      ]),
    );
  });

  it('whmcs_get_service_details returns JSON text', async () => {
    const { mcp, handlers } = makeServer();
    registerProvisioningTools(mcp as never, { provisioning: prov, capabilities: { hasModuleQueue: true } as never });
    const out = await handlers['whmcs_get_service_details']({ serviceId: 1001 });
    expect(out.content[0].text).toContain('"id": 1001');
    expect(out.content[0].text).toContain('"status": "Pending"');
  });

  it('whmcs_resync_service is blocked when WHMCS_ALLOW_MUTATIONS is unset', async () => {
    const { mcp, handlers } = makeServer();
    registerProvisioningTools(mcp as never, { provisioning: prov, capabilities: { hasModuleQueue: true } as never });
    const out = await handlers['whmcs_resync_service']({ serviceId: 1001, confirm: true });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/WHMCS_ALLOW_MUTATIONS/);
  });

  it('whmcs_resync_service is blocked when confirm is not true', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    const { mcp, handlers } = makeServer();
    registerProvisioningTools(mcp as never, { provisioning: prov, capabilities: { hasModuleQueue: true } as never });
    const out = await handlers['whmcs_resync_service']({ serviceId: 1001 });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/confirm: true/);
  });

  it('whmcs_resync_service runs when enabled and confirmed', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    const { mcp, handlers } = makeServer();
    registerProvisioningTools(mcp as never, { provisioning: prov, capabilities: { hasModuleQueue: true } as never });
    const out = await handlers['whmcs_resync_service']({ serviceId: 1001, confirm: true, action: 'Create' });
    expect(out.isError).toBeUndefined();
    expect(out.content[0].text).toMatch(/successfully/i);
  });

  it('whmcs_get_module_queue surfaces unsupported state as a structured message', async () => {
    const { mcp, handlers } = makeServer();
    registerProvisioningTools(mcp as never, { provisioning: prov, capabilities: { hasModuleQueue: false } as never });
    const out = await handlers['whmcs_get_module_queue']({});
    expect(out.content[0].text).toMatch(/WHMCS.*8/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npm test -- mcp/tools/provisioning`
Expected: module not found.

- [ ] **Step 3: Implement the registrar**

Create `src/mcp/tools/provisioning.ts`:
```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ProvisioningDomain } from '../../whmcs/domains/provisioning.js';
import type { Capabilities } from '../../whmcs/version.js';
import { requireMutations } from '../mutations.js';

export interface ProvisioningToolDeps {
  provisioning: ProvisioningDomain;
  capabilities: Capabilities;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

export function registerProvisioningTools(server: McpServer, deps: ProvisioningToolDeps): void {
  server.registerTool(
    'whmcs_get_service_details',
    {
      title: 'Get full state of a WHMCS service',
      description: 'Returns status, assigned server, billing, and identity fields for one service (product instance).',
      inputSchema: { serviceId: z.number().int().positive() },
    },
    async ({ serviceId }) => {
      try { return ok(await deps.provisioning.getServiceDetails(serviceId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_module_log',
    {
      title: 'Get module command log for a service',
      description: 'Returns activity-log entries (Create/Suspend/Terminate attempts + errors) related to a given service ID.',
      inputSchema: {
        serviceId: z.number().int().positive(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async ({ serviceId, limit }) => {
      try { return ok(await deps.provisioning.getModuleLog(serviceId, { limit })); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_module_queue',
    {
      title: 'Get pending/failed module operations queue',
      description: 'Returns the WHMCS module queue (WHMCS 8.0+). On older versions, returns a structured "unsupported" message.',
      inputSchema: {},
    },
    async () => {
      try {
        const q = await deps.provisioning.getModuleQueue(deps.capabilities);
        return ok(q);
      } catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_server_usage',
    {
      title: 'Get provisioning server utilization',
      description: 'Returns per-server used/capacity/headroom, highlighting servers near capacity.',
      inputSchema: {},
    },
    async () => {
      try { return ok(await deps.provisioning.getServerUsage()); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_resync_service',
    {
      title: 'Re-run a module command for a service (MUTATING)',
      description:
        'Re-runs a module action (Create by default) against the assigned server for the service. Requires WHMCS_ALLOW_MUTATIONS=true and confirm: true.',
      inputSchema: {
        serviceId: z.number().int().positive(),
        action: z
          .enum(['Create', 'Suspend', 'Unsuspend', 'Terminate', 'ChangePackage', 'ChangePassword'])
          .optional(),
        confirm: z.boolean().optional(),
      },
    },
    async ({ serviceId, action, confirm }) => {
      try {
        requireMutations('whmcs_resync_service', confirm);
        const res = await deps.provisioning.resyncService(serviceId, action);
        return ok(res);
      } catch (e) { return fail((e as Error).message); }
    },
  );
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm test -- mcp/tools/provisioning`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/provisioning.ts test/unit/mcp/tools/provisioning.test.ts
git commit -m "feat(mcp): provisioning forensics tools (5 tools, mutation-guarded)"
```

---

## Task 9: Wire into entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add imports near other new-module imports**

Open `src/index.ts` and add after the Phase 0 imports:
```typescript
import { probeCapabilities } from './whmcs/version.js';
import { ProvisioningDomain } from './whmcs/domains/provisioning.js';
import { registerProvisioningTools } from './mcp/tools/provisioning.js';
```

- [ ] **Step 2: Probe capabilities at startup and register the new tools**

Find the Phase 0 wiring block (where `registerSystemTools` is called) and *after* it add:
```typescript
const capabilities = await probeCapabilities(newClient);
console.error(`[whmcs-mcp] detected WHMCS version: ${capabilities.version}`);
registerProvisioningTools(server, {
  provisioning: new ProvisioningDomain(newClient),
  capabilities,
});
```

> If the startup function isn't `async`, convert it to `async` and `await` these calls. If `newClient` is currently constructed inside the startup function, make sure `capabilities` is probed after construction and before the SDK server calls `connect`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 4: Run full suite**

Run: `npm test`
Expected: all green (Phase 0 tests + Phase 1 tests ≈ 25+ total).

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire provisioning domain + capability probe into entrypoint"
```

---

## Task 10: Documentation + changelog

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/API_REFERENCE.md`

- [ ] **Step 1: Update CHANGELOG**

Append under `## Unreleased` → `### Added`:
```markdown
- `whmcs_get_service_details` — full state of a single service
- `whmcs_get_module_log` — activity-log entries filtered to a service
- `whmcs_get_module_queue` — pending/failed module operations (WHMCS 8.0+)
- `whmcs_get_server_usage` — per-server utilization & headroom
- `whmcs_resync_service` — re-run module action (guarded by `WHMCS_ALLOW_MUTATIONS=true` + `confirm: true`)
- Startup-time WHMCS version probe; version-gated tools report structured "unsupported" responses on older versions
```

- [ ] **Step 2: Update README env vars table**

In `README.md`, add a row to the env-vars table:
```markdown
| `WHMCS_ALLOW_MUTATIONS` | No  | Set to `true` to enable mutating tools (`whmcs_resync_service`, …). Default: disabled. |
```

- [ ] **Step 3: Add new tool docs to API_REFERENCE**

In `docs/API_REFERENCE.md`, add a new section "Provisioning Forensics" listing the 5 new tools with parameters (modeled on existing sections — shape: tool name, description, parameter table, example).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md README.md docs/API_REFERENCE.md
git commit -m "docs: document Phase 1 provisioning forensics tools"
```

---

## Task 11: Verification

**Files:** (no changes)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 2: TypeScript no-emit check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Boot smoke-check**

Run:
```bash
node -e "const {spawn}=require('child_process');const p=spawn('node',['dist/index.js'],{env:{...process.env,WHMCS_API_URL:'http://127.0.0.1:1/',WHMCS_API_IDENTIFIER:'x',WHMCS_API_SECRET:'y'}});setTimeout(()=>{console.log('alive=',!p.killed);p.kill();process.exit(0);},500);"
```
Expected: `alive= true`. (We're not testing tool behavior here, just that startup succeeds with the new version probe step — which may log a failure to reach the bogus URL but should not crash.)

> If the probe crashes the process because the URL is unreachable, wrap the probe in a try/catch in `src/index.ts` that falls back to `hasModuleQueue: false, hasCreateSsoToken: false, hasGetCredits: false, version: 'unknown'` (mirroring the `probeCapabilities` error path). Then re-run this step.

- [ ] **Step 4: (Optional, when live access is available) re-capture fixtures**

Run:
```bash
npm run capture -- GetClientsProducts serviceid=<real-id>
npm run capture -- GetActivityLog description="Service ID <real-id>" limitnum=25
npm run capture -- GetServers
npm run capture -- WhmcsDetails
```
Expected: scrubbed JSON files under `test/fixtures/`. Commit with message `test: refresh fixtures from live WHMCS`.

---

## Self-Review Results

- **Spec coverage:** all five Phase 1 tools (get_service_details, get_module_log, get_module_queue, resync_service, get_server_usage) are implemented + tested + wired + documented.
- **Placeholder scan:** no TBDs; all test bodies and implementation bodies are concrete.
- **Type consistency:** `ProvisioningDomain` methods' return types match the tool handlers' expectations; `Capabilities` (from Phase 0) used consistently; `ModuleAction` enum in the domain aligns with the zod enum in the tool schema.

## Completion Criteria

- All tests pass (`npm test`), ≥ 19 new assertions in provisioning files, 6 in mutations file.
- `whmcs_resync_service` refuses to run unless `WHMCS_ALLOW_MUTATIONS=true` AND `confirm: true` are both provided.
- `whmcs_get_module_queue` returns a structured `{ supported: false, reason: ... }` on WHMCS < 8.0 instead of throwing.
- `dist/index.js` boots to stdio-ready state with the probe step included.
- CHANGELOG + README + API_REFERENCE reflect the new tools.
