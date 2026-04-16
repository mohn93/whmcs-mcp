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
