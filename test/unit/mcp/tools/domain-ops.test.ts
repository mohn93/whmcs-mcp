import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { DomainOpsDomain } from '../../../../src/whmcs/domains/domain-ops';
import { registerDomainOpsTools } from '../../../../src/mcp/tools/domain-ops';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';

import domainsFixture from '../../../fixtures/GetClientsDomains-all.json';

type Handler = (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

let server: MockWhmcsServer;
let domainOps: DomainOpsDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetClientsDomains: domainsFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  domainOps = new DomainOpsDomain(client);
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

describe('registerDomainOpsTools', () => {
  it('registers 3 domain ops tools', () => {
    const { mcp } = makeServer();
    registerDomainOpsTools(mcp as never, { domainOps });
    const names = mcp.registerTool.mock.calls.map((c: any) => c[0]);
    expect(names).toEqual([
      'whmcs_get_pending_transfers',
      'whmcs_get_upcoming_renewals',
      'whmcs_get_domain_details',
    ]);
  });

  it('whmcs_get_pending_transfers returns filtered list', async () => {
    const { mcp, handlers } = makeServer();
    registerDomainOpsTools(mcp as never, { domainOps });
    const out = await handlers['whmcs_get_pending_transfers']({});
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].domainname).toBe('transfer.test');
    expect(parsed[0].status).toBe('Pending Transfer');
  });

  it('whmcs_get_domain_details returns error for missing domain', async () => {
    server.setFixture('GetClientsDomains', {
      result: 'success', totalresults: 0, domains: { domain: [] },
    });
    const { mcp, handlers } = makeServer();
    registerDomainOpsTools(mcp as never, { domainOps });
    const out = await handlers['whmcs_get_domain_details']({ domainId: 999 });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/Domain 999 not found/);
    // Restore fixture
    server.setFixture('GetClientsDomains', domainsFixture);
  });
});
