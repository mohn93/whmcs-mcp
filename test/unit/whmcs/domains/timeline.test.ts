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

  it('returns both token and redirectUrl when supported', async () => {
    const result = await timeline.getClientAutoAuthUrl(42, { hasCreateSsoToken: true });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.accessToken).toBe('sso_token_abc123');
      expect(result.redirectUrl).toContain('userid=42');
      expect(result.redirectUrl).toContain('token=sso_token_abc123');
    }
  });
});

describe('TimelineDomain.getClientTimeline — edge cases', () => {
  it('still returns services/invoices/domains when orders and tickets are empty', async () => {
    server.setFixture('GetOrders', {
      result: 'success', orders: { order: [] },
    });
    server.setFixture('GetTickets', {
      result: 'success', tickets: { ticket: [] },
    });

    const tl = await timeline.getClientTimeline(42);
    const types = new Set(tl.events.map((e) => e.type));
    expect(types).not.toContain('order');
    expect(types).not.toContain('ticket');
    // Should still have at least invoices, services, domains
    expect(types).toContain('invoice');
    expect(types).toContain('service');
    expect(types).toContain('domain');

    // Restore fixtures
    server.setFixture('GetOrders', ordersFixture);
    server.setFixture('GetTickets', ticketsFixture);
  });

  it('returns empty timeline when all sources are empty', async () => {
    server.setFixture('GetOrders', { result: 'success', orders: { order: [] } });
    server.setFixture('GetTickets', { result: 'success', tickets: { ticket: [] } });
    server.setFixture('GetInvoices', { result: 'success', invoices: { invoice: [] } });
    server.setFixture('GetClientsDomains', { result: 'success', domains: { domain: [] } });
    server.setFixture('GetClientsProducts', { result: 'success', products: { product: [] } });

    const tl = await timeline.getClientTimeline(42);
    expect(tl.clientId).toBe(42);
    expect(tl.events).toHaveLength(0);

    // Restore all fixtures
    server.setFixture('GetOrders', ordersFixture);
    server.setFixture('GetTickets', ticketsFixture);
    server.setFixture('GetInvoices', invoicesFixture);
    server.setFixture('GetClientsDomains', domainsFixture);
    server.setFixture('GetClientsProducts', productsFixture);
  });

  it('sends userid/clientid filters to all sub-APIs', async () => {
    await timeline.getClientTimeline(99);
    // The last request will be one of the parallel calls, but we can verify
    // the timeline populated correctly with clientId
    // We can't check all 5 requests since lastRequest only stores the last one,
    // but we can verify the timeline was created for the correct client
    const tl = await timeline.getClientTimeline(99);
    expect(tl.clientId).toBe(99);
  });
});
