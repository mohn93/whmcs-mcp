# Phase 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a real test harness (vitest + mock WHMCS + PII-scrubbing fixture capture), extract the monolithic `WhmcsClient` and `index.ts` into domain-scoped modules, and add a runtime WHMCS version probe — so every subsequent feature phase lands in a structured, tested codebase.

**Architecture:** Introduce `src/whmcs/` (domain-split API client) and `src/mcp/` (tool/prompt/resource registrations split by domain) alongside the existing files. Migrate ONE domain (`system`, containing `GetStats`) end-to-end as the template; leave the rest untouched for future phases to migrate as they touch them. Tests run against an in-process mock WHMCS HTTP server using real fixture JSON (anonymized captures or synthetic). A standalone capture script can scrape + scrub live responses into fixtures.

**Tech Stack:** TypeScript 5, Node 18+, `@modelcontextprotocol/sdk`, axios (existing), **vitest** (new), Node's built-in `http` for the mock server (no new dep).

---

## File Structure

```
src/
  whmcs/
    client.ts              # NEW — base HTTP caller
    types.ts               # NEW — shared response types + domain result types
    version.ts             # NEW — runtime version probe + capability flags
    domains/
      system.ts            # NEW — GetStats, GetActivityLog, etc. (migrated as template)
  mcp/
    server.ts              # NEW — McpServer setup, transport wiring
    tools/
      system.ts            # NEW — tool registrations for system domain (template)
  whmcs-client.ts          # EXISTING — leave in place; legacy methods still callable
  index.ts                 # EXISTING — refactored to delegate system-domain registrations to mcp/tools/system.ts
test/
  mock-whmcs.ts            # NEW — in-process HTTP server
  fixtures/
    GetStats.json          # NEW — sample fixture
    WhmcsDetails.json      # NEW — sample fixture
  scripts/
    capture-fixtures.ts    # NEW — live→scrubbed capture tool
  unit/
    whmcs/
      client.test.ts       # NEW
      version.test.ts      # NEW
      domains/
        system.test.ts     # NEW
    mcp/
      tools/
        system.test.ts     # NEW
vitest.config.ts           # NEW
```

---

## Task 1: Add vitest and test scripts

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest as dev dependency**

Run:
```bash
npm install -D vitest @types/node
```
Expected: `vitest` added to `devDependencies`, no errors.

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    globals: false,
    environment: 'node',
    testTimeout: 5000,
    hookTimeout: 5000,
  },
});
```

- [ ] **Step 3: Update package.json scripts**

In `package.json`, replace `"scripts"` with:
```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "tsx src/index.ts",
  "watch": "tsc --watch",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:live": "tsx src/test.ts"
}
```

- [ ] **Step 4: Write a canary test to verify vitest runs**

Create `test/unit/canary.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('canary', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run canary**

Run: `npm test`
Expected: `1 passed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts test/unit/canary.test.ts
git commit -m "chore: add vitest test harness with canary"
```

---

## Task 2: Build mock WHMCS HTTP server

**Files:**
- Create: `test/mock-whmcs.ts`
- Create: `test/unit/mock-whmcs.test.ts`
- Create: `test/fixtures/GetStats.json`

- [ ] **Step 1: Write a failing test for the mock server**

Create `test/unit/mock-whmcs.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startMockWhmcs, type MockWhmcsServer } from '../mock-whmcs';

let server: MockWhmcsServer;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetStats: { result: 'success', stats: { income_today: '0.00' } },
    },
  });
});

afterAll(async () => {
  await server.stop();
});

describe('mock-whmcs', () => {
  it('returns a fixture for the requested action', async () => {
    const body = new URLSearchParams({
      action: 'GetStats',
      identifier: 'test-id',
      secret: 'test-secret',
      responsetype: 'json',
    });
    const res = await fetch(`${server.url}/includes/api.php`, {
      method: 'POST',
      body,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBe('success');
    expect(json.stats.income_today).toBe('0.00');
  });

  it('returns 404-shaped error for unknown action', async () => {
    const body = new URLSearchParams({
      action: 'DoesNotExist',
      identifier: 'test-id',
      secret: 'test-secret',
      responsetype: 'json',
    });
    const res = await fetch(`${server.url}/includes/api.php`, {
      method: 'POST',
      body,
    });
    const json = await res.json();
    expect(json.result).toBe('error');
    expect(json.message).toMatch(/unknown action/i);
  });

  it('records the last request for assertions', async () => {
    const body = new URLSearchParams({
      action: 'GetStats',
      identifier: 'test-id',
      secret: 'test-secret',
      responsetype: 'json',
      extra: 'value',
    });
    await fetch(`${server.url}/includes/api.php`, { method: 'POST', body });
    const last = server.lastRequest();
    expect(last?.params.get('action')).toBe('GetStats');
    expect(last?.params.get('extra')).toBe('value');
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

Run: `npm test -- mock-whmcs`
Expected: fail with "Cannot find module '../mock-whmcs'" or similar.

- [ ] **Step 3: Implement the mock server**

Create `test/mock-whmcs.ts`:
```typescript
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';

export interface MockRequest {
  params: URLSearchParams;
  rawBody: string;
}

export interface MockWhmcsServer {
  url: string;
  stop: () => Promise<void>;
  lastRequest: () => MockRequest | undefined;
  setFixture: (action: string, response: unknown) => void;
}

interface MockOptions {
  fixtures?: Record<string, unknown>;
}

export async function startMockWhmcs(options: MockOptions = {}): Promise<MockWhmcsServer> {
  const fixtures = new Map<string, unknown>(Object.entries(options.fixtures ?? {}));
  let last: MockRequest | undefined;

  const handler = (req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const params = new URLSearchParams(body);
      last = { params, rawBody: body };
      const action = params.get('action') ?? '';
      const fixture = fixtures.get(action);
      res.setHeader('Content-Type', 'application/json');
      if (fixture === undefined) {
        res.statusCode = 200;
        res.end(JSON.stringify({ result: 'error', message: `unknown action: ${action}` }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(fixture));
    });
  };

  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
    lastRequest: () => last,
    setFixture: (action, response) => fixtures.set(action, response),
  };
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npm test -- mock-whmcs`
Expected: 3 passed.

- [ ] **Step 5: Create a real fixture file**

Create `test/fixtures/GetStats.json`:
```json
{
  "result": "success",
  "stats": {
    "income_today": "0.00",
    "income_thismonth": "0.00",
    "income_thisyear": "0.00",
    "income_alltime": "0.00",
    "orders_pending_count": 0,
    "tickets_awaitingreply_count": 0,
    "invoices_unpaid_count": 0
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add test/mock-whmcs.ts test/unit/mock-whmcs.test.ts test/fixtures/GetStats.json
git commit -m "test: add in-process mock WHMCS HTTP server with fixture loader"
```

---

## Task 3: Extract WhmcsClient base class

**Files:**
- Create: `src/whmcs/client.ts`
- Create: `src/whmcs/types.ts`
- Create: `test/unit/whmcs/client.test.ts`

- [ ] **Step 1: Write failing test for the new client**

Create `test/unit/whmcs/client.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../src/whmcs/client';
import { startMockWhmcs, type MockWhmcsServer } from '../../mock-whmcs';

let server: MockWhmcsServer;
let client: WhmcsClient;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetStats: { result: 'success', stats: { income_today: '1.23' } },
      Fails: { result: 'error', message: 'nope' },
    },
  });
  client = new WhmcsClient({
    apiUrl: server.url + '/',
    identifier: 'id',
    secret: 'sec',
  });
});

afterAll(async () => {
  await server.stop();
});

describe('WhmcsClient', () => {
  it('calls an action and returns the parsed body', async () => {
    const res = await client.call<{ stats: { income_today: string } }>('GetStats');
    expect(res.stats.income_today).toBe('1.23');
  });

  it('sends auth params on every call', async () => {
    await client.call('GetStats');
    const last = server.lastRequest();
    expect(last?.params.get('identifier')).toBe('id');
    expect(last?.params.get('secret')).toBe('sec');
    expect(last?.params.get('responsetype')).toBe('json');
  });

  it('throws with the WHMCS error message on result=error', async () => {
    await expect(client.call('Fails')).rejects.toThrow(/nope/);
  });

  it('includes optional access key when configured', async () => {
    const c2 = new WhmcsClient({
      apiUrl: server.url + '/',
      identifier: 'id',
      secret: 'sec',
      accesskey: 'KEY',
    });
    await c2.call('GetStats');
    expect(server.lastRequest()?.params.get('accesskey')).toBe('KEY');
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- whmcs/client`
Expected: fail with "Cannot find module" for `src/whmcs/client`.

- [ ] **Step 3: Create shared types**

Create `src/whmcs/types.ts`:
```typescript
export interface WhmcsApiResponse {
  result: 'success' | 'error';
  message?: string;
}

export interface WhmcsClientConfig {
  apiUrl: string;
  identifier: string;
  secret: string;
  accesskey?: string;
}
```

- [ ] **Step 4: Implement `WhmcsClient`**

Create `src/whmcs/client.ts`:
```typescript
import axios, { type AxiosInstance } from 'axios';
import type { WhmcsApiResponse, WhmcsClientConfig } from './types.js';

export class WhmcsClient {
  private http: AxiosInstance;

  constructor(private config: WhmcsClientConfig) {
    const base = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
    this.http = axios.create({
      baseURL: base,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async call<T extends Record<string, unknown> = Record<string, unknown>>(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<T & WhmcsApiResponse> {
    const body = new URLSearchParams({
      action,
      identifier: this.config.identifier,
      secret: this.config.secret,
      responsetype: 'json',
      ...(this.config.accesskey ? { accesskey: this.config.accesskey } : {}),
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, v == null ? '' : String(v)]),
      ),
    });

    const res = await this.http.post<T & WhmcsApiResponse>('includes/api.php', body);

    if (res.data.result === 'error') {
      throw new Error(`WHMCS API error (${action}): ${res.data.message ?? 'unknown'}`);
    }
    return res.data;
  }
}
```

- [ ] **Step 5: Run test, confirm pass**

Run: `npm test -- whmcs/client`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/whmcs/client.ts src/whmcs/types.ts test/unit/whmcs/client.test.ts
git commit -m "feat(whmcs): extract WhmcsClient base into src/whmcs/"
```

---

## Task 4: Runtime WHMCS version probe + capability flags

**Files:**
- Create: `src/whmcs/version.ts`
- Create: `test/unit/whmcs/version.test.ts`
- Create: `test/fixtures/WhmcsDetails.json`

- [ ] **Step 1: Write failing test for version probe**

Create `test/unit/whmcs/version.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WhmcsClient } from '../../../src/whmcs/client';
import { probeCapabilities } from '../../../src/whmcs/version';
import { startMockWhmcs, type MockWhmcsServer } from '../../mock-whmcs';

let server: MockWhmcsServer;

beforeEach(async () => {
  server = await startMockWhmcs();
});
afterEach(async () => {
  await server.stop();
});

const clientFor = (mock: MockWhmcsServer) =>
  new WhmcsClient({ apiUrl: mock.url + '/', identifier: 'id', secret: 'sec' });

describe('probeCapabilities', () => {
  it('reports version and derives capability flags for WHMCS 8.x', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '8.11.0', canonicalversion: '8.11.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('8.11.0');
    expect(caps.major).toBe(8);
    expect(caps.hasModuleQueue).toBe(true);
    expect(caps.hasCreateSsoToken).toBe(true);
    expect(caps.hasGetCredits).toBe(true);
  });

  it('flags older WHMCS versions as lacking ModuleQueue', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '7.10.0', canonicalversion: '7.10.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.major).toBe(7);
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(true); // 7.7+
    expect(caps.hasGetCredits).toBe(true);     // 7.1+
  });

  it('returns unknown capability set if WhmcsDetails itself is unsupported', async () => {
    // no fixture registered → mock returns result=error for unknown action
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('unknown');
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(false);
    expect(caps.hasGetCredits).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- whmcs/version`
Expected: fail — no `version.ts` yet.

- [ ] **Step 3: Implement the probe**

Create `src/whmcs/version.ts`:
```typescript
import type { WhmcsClient } from './client.js';

export interface Capabilities {
  version: string;                // "8.11.0" or "unknown"
  major: number;                  // 8, 7, or 0 if unknown
  minor: number;
  hasModuleQueue: boolean;        // 8.0+
  hasCreateSsoToken: boolean;     // 7.7+
  hasGetCredits: boolean;         // 7.1+
}

export async function probeCapabilities(client: WhmcsClient): Promise<Capabilities> {
  try {
    const res = await client.call<{ whmcs: { version: string } }>('WhmcsDetails');
    const version = res.whmcs?.version ?? 'unknown';
    const match = /^(\d+)\.(\d+)/.exec(version);
    const major = match ? Number(match[1]) : 0;
    const minor = match ? Number(match[2]) : 0;
    return {
      version,
      major,
      minor,
      hasModuleQueue: major >= 8,
      hasCreateSsoToken: major > 7 || (major === 7 && minor >= 7),
      hasGetCredits: major > 7 || (major === 7 && minor >= 1),
    };
  } catch {
    return {
      version: 'unknown',
      major: 0,
      minor: 0,
      hasModuleQueue: false,
      hasCreateSsoToken: false,
      hasGetCredits: false,
    };
  }
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `npm test -- whmcs/version`
Expected: 3 passed.

- [ ] **Step 5: Create sample fixture**

Create `test/fixtures/WhmcsDetails.json`:
```json
{
  "result": "success",
  "whmcs": {
    "version": "8.11.0",
    "canonicalversion": "8.11.0-release.1"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/whmcs/version.ts test/unit/whmcs/version.test.ts test/fixtures/WhmcsDetails.json
git commit -m "feat(whmcs): add runtime version probe + capability flags"
```

---

## Task 5: Migrate `system` domain as template

**Files:**
- Create: `src/whmcs/domains/system.ts`
- Create: `test/unit/whmcs/domains/system.test.ts`

- [ ] **Step 1: Write failing test for the system domain**

Create `test/unit/whmcs/domains/system.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { SystemDomain } from '../../../../src/whmcs/domains/system';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import fixture from '../../../fixtures/GetStats.json';

let server: MockWhmcsServer;
let system: SystemDomain;

beforeAll(async () => {
  server = await startMockWhmcs({ fixtures: { GetStats: fixture } });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  system = new SystemDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('SystemDomain.getStats', () => {
  it('returns typed stats', async () => {
    const stats = await system.getStats();
    expect(stats.income_today).toBe('0.00');
    expect(stats.orders_pending_count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- domains/system`
Expected: fail — module not found.

- [ ] **Step 3: Implement `SystemDomain`**

Create `src/whmcs/domains/system.ts`:
```typescript
import type { WhmcsClient } from '../client.js';

export interface GetStatsResult {
  income_today: string;
  income_thismonth: string;
  income_thisyear: string;
  income_alltime: string;
  orders_pending_count: number;
  tickets_awaitingreply_count: number;
  invoices_unpaid_count: number;
}

export class SystemDomain {
  constructor(private client: WhmcsClient) {}

  async getStats(): Promise<GetStatsResult> {
    const res = await this.client.call<{ stats: GetStatsResult }>('GetStats');
    return res.stats;
  }
}
```

- [ ] **Step 4: Configure TypeScript to allow JSON imports**

In `tsconfig.json`, ensure `compilerOptions` contains:
```json
"resolveJsonModule": true,
"esModuleInterop": true
```

(If they're already there, no change needed.)

- [ ] **Step 5: Run test, confirm pass**

Run: `npm test -- domains/system`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add src/whmcs/domains/system.ts test/unit/whmcs/domains/system.test.ts tsconfig.json
git commit -m "feat(whmcs): add SystemDomain as migration template (GetStats)"
```

---

## Task 6: MCP tool registration module for system domain

**Files:**
- Create: `src/mcp/tools/system.ts`
- Create: `test/unit/mcp/tools/system.test.ts`

- [ ] **Step 1: Write failing test for tool registration**

Create `test/unit/mcp/tools/system.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { SystemDomain } from '../../../../src/whmcs/domains/system';
import { registerSystemTools } from '../../../../src/mcp/tools/system';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import fixture from '../../../fixtures/GetStats.json';

let server: MockWhmcsServer;

beforeAll(async () => {
  server = await startMockWhmcs({ fixtures: { GetStats: fixture } });
});
afterAll(async () => { await server.stop(); });

describe('registerSystemTools', () => {
  it('registers whmcs_get_stats and invokes the domain method', async () => {
    const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
    const system = new SystemDomain(client);

    const registrations: Record<string, (args: unknown) => Promise<unknown>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => {
        registrations[name] = handler;
      }),
    };

    registerSystemTools(mockServer as never, { system });

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'whmcs_get_stats',
      expect.any(Object),
      expect.any(Function),
    );

    const result = await registrations['whmcs_get_stats']({});
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('"income_today"') }],
    });
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- mcp/tools/system`
Expected: fail — module not found.

- [ ] **Step 3: Implement the registrar**

Create `src/mcp/tools/system.ts`:
```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SystemDomain } from '../../whmcs/domains/system.js';

export interface SystemToolDeps {
  system: SystemDomain;
}

export function registerSystemTools(server: McpServer, deps: SystemToolDeps): void {
  server.registerTool(
    'whmcs_get_stats',
    {
      title: 'Get WHMCS system statistics',
      description: 'Returns income, pending orders, unpaid invoices, and awaiting-reply ticket counts.',
      inputSchema: {},
    },
    async () => {
      const stats = await deps.system.getStats();
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    },
  );
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `npm test -- mcp/tools/system`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/system.ts test/unit/mcp/tools/system.test.ts
git commit -m "feat(mcp): add system tool registrations (template pattern)"
```

---

## Task 7: Wire the new modules into the existing entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Locate the existing GetStats registration**

Run: `grep -n "whmcs_get_stats" src/index.ts`
Expected: one or two lines matching tool registration.

- [ ] **Step 2: Replace the existing GetStats tool registration with a call into the new module**

In `src/index.ts`, near the top of the file after existing imports, add:
```typescript
import { WhmcsClient as NewWhmcsClient } from './whmcs/client.js';
import { SystemDomain } from './whmcs/domains/system.js';
import { registerSystemTools } from './mcp/tools/system.js';
```

Then, in the function that constructs and configures the MCP server (search for `new McpServer` or `server.registerTool('whmcs_get_stats'`), **delete the existing `whmcs_get_stats` registration block** and after the `new McpServer` construction add:
```typescript
const newClient = new NewWhmcsClient({
  apiUrl: process.env.WHMCS_API_URL!,
  identifier: process.env.WHMCS_API_IDENTIFIER!,
  secret: process.env.WHMCS_API_SECRET!,
  accesskey: process.env.WHMCS_ACCESS_KEY || undefined,
});
registerSystemTools(server, { system: new SystemDomain(newClient) });
```

- [ ] **Step 3: Build to catch typing issues**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests green, including canary + mock server + client + version + system + tool registration.

- [ ] **Step 5: Smoke-run the MCP entrypoint to verify it still boots**

Run:
```bash
node -e "const {spawn}=require('child_process');const p=spawn('node',['dist/index.js'],{env:{...process.env,WHMCS_API_URL:'http://127.0.0.1:1/',WHMCS_API_IDENTIFIER:'x',WHMCS_API_SECRET:'y'}});setTimeout(()=>{console.log('alive=',!p.killed);p.kill();process.exit(0);},500);"
```
Expected: prints `alive= true` and exits. (We don't expect tool calls to succeed — just that the process stays alive listening on stdio.)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "refactor: wire new system tool module into MCP entrypoint"
```

---

## Task 8: PII-scrubbing fixture capture script

**Files:**
- Create: `test/scripts/capture-fixtures.ts`
- Create: `test/scripts/scrub.ts`
- Create: `test/unit/scripts/scrub.test.ts`

- [ ] **Step 1: Write failing test for the scrubber**

Create `test/unit/scripts/scrub.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { scrub } from '../../../test/scripts/scrub';

describe('scrub', () => {
  it('replaces email addresses with deterministic placeholders', () => {
    const input = { email: 'jane@real.com', notes: 'cc: bob@acme.co' };
    const out = scrub(input) as typeof input;
    expect(out.email).toMatch(/^client\d+@example\.test$/);
    expect(out.notes).toMatch(/cc: client\d+@example\.test/);
  });

  it('blanks first/last name, address1/2, phonenumber', () => {
    const input = {
      firstname: 'Jane', lastname: 'Doe',
      address1: '1 Main St', address2: 'Apt 4',
      phonenumber: '+218 91 1234567',
    };
    const out = scrub(input) as typeof input;
    expect(out.firstname).toBe('REDACTED');
    expect(out.lastname).toBe('REDACTED');
    expect(out.address1).toBe('REDACTED');
    expect(out.address2).toBe('REDACTED');
    expect(out.phonenumber).toBe('REDACTED');
  });

  it('recurses into arrays and nested objects', () => {
    const input = { clients: [{ email: 'a@b.com', deep: { email: 'c@d.com' } }] };
    const out = scrub(input) as { clients: Array<{ email: string; deep: { email: string } }> };
    expect(out.clients[0].email).toMatch(/^client\d+@example\.test$/);
    expect(out.clients[0].deep.email).toMatch(/^client\d+@example\.test$/);
  });

  it('leaves numbers, booleans, and non-PII strings alone', () => {
    const input = { id: 42, active: true, currency: 'USD' };
    expect(scrub(input)).toEqual(input);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

Run: `npm test -- scripts/scrub`
Expected: fail — module not found.

- [ ] **Step 3: Implement the scrubber**

Create `test/scripts/scrub.ts`:
```typescript
const PII_KEYS = new Set([
  'firstname', 'lastname', 'fullname', 'companyname',
  'address1', 'address2', 'postcode', 'phonenumber',
  'tax_id', 'taxid', 'vat',
]);
const EMAIL_RE = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;

export function scrub(value: unknown, counters: { email: number } = { email: 0 }): unknown {
  if (Array.isArray(value)) return value.map((v) => scrub(v, counters));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase()) && typeof v === 'string') {
        out[k] = 'REDACTED';
      } else {
        out[k] = scrub(v, counters);
      }
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.replace(EMAIL_RE, () => `client${++counters.email}@example.test`);
  }
  return value;
}
```

- [ ] **Step 4: Run test, confirm pass**

Run: `npm test -- scripts/scrub`
Expected: 4 passed.

- [ ] **Step 5: Implement the capture CLI**

Create `test/scripts/capture-fixtures.ts`:
```typescript
/**
 * Usage:
 *   tsx test/scripts/capture-fixtures.ts <Action> [key=value ...]
 * Reads WHMCS_API_URL/WHMCS_API_IDENTIFIER/WHMCS_API_SECRET from the environment,
 * fetches the given action with the given params, scrubs PII, writes to
 * test/fixtures/<Action>.json.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { WhmcsClient } from '../../src/whmcs/client.js';
import { scrub } from './scrub.js';

async function main() {
  const [, , action, ...kv] = process.argv;
  if (!action) {
    console.error('Usage: tsx test/scripts/capture-fixtures.ts <Action> [key=value ...]');
    process.exit(2);
  }
  const params = Object.fromEntries(
    kv.map((pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) throw new Error(`Bad arg: ${pair}`);
      return [pair.slice(0, idx), pair.slice(idx + 1)];
    }),
  );
  const client = new WhmcsClient({
    apiUrl: required('WHMCS_API_URL'),
    identifier: required('WHMCS_API_IDENTIFIER'),
    secret: required('WHMCS_API_SECRET'),
    accesskey: process.env.WHMCS_ACCESS_KEY || undefined,
  });
  const response = await client.call(action, params);
  const scrubbed = scrub(response);
  const path = resolve('test/fixtures', `${action}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(scrubbed, null, 2) + '\n');
  console.log(`Wrote ${path}`);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 6: Add a convenience npm script**

In `package.json` `scripts`, add:
```json
"capture": "tsx test/scripts/capture-fixtures.ts"
```

- [ ] **Step 7: Commit**

```bash
git add test/scripts/capture-fixtures.ts test/scripts/scrub.ts test/unit/scripts/scrub.test.ts package.json
git commit -m "test: add PII-scrubbing fixture capture script"
```

---

## Task 9: Verification sweep

**Files:** (no changes)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests green.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean compile.

- [ ] **Step 3: Confirm no new TypeScript errors**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Confirm the legacy smoke test still works (offline)**

Run: `tsx -e "import('./src/whmcs/client.js').then(m => console.log(typeof m.WhmcsClient))"`
Expected: prints `function`.

- [ ] **Step 5: Update CHANGELOG**

Add to `CHANGELOG.md` (top):
```markdown
## Unreleased

### Added
- vitest test harness with in-process mock WHMCS server
- `WhmcsClient` base class under `src/whmcs/client.ts`
- Runtime WHMCS version probe + capability flags (`src/whmcs/version.ts`)
- Domain split pattern: `src/whmcs/domains/system.ts`, `src/mcp/tools/system.ts`
- PII-scrubbing fixture capture script (`npm run capture -- <Action>`)
```

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Phase 0 foundations"
```

---

## Self-Review Results

- **Spec coverage:** all six architectural items from the scoping doc (vitest, mock server, capability probe, client split, tool-registrar split, fixture capture) map to tasks 1–8.
- **Placeholder scan:** no TBDs or hand-waving; every code block is complete.
- **Type consistency:** `WhmcsClient`, `WhmcsClientConfig`, `SystemDomain`, `GetStatsResult`, `Capabilities` used consistently across tasks.

## Completion Criteria

- `npm test` green (≥ 15 tests across 7 files)
- `npm run build` clean
- `src/index.ts` delegates `whmcs_get_stats` to the new modules
- `npm run capture -- GetStats` writes a scrubbed fixture when real WHMCS is reachable
- No new `any` types in the new `src/whmcs/**` or `src/mcp/**` files
