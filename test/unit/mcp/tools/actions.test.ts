import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ActionDomain } from '../../../../src/whmcs/domains/actions';
import { registerActionTools, type ActionToolDeps } from '../../../../src/mcp/tools/actions';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';

import applyCreditFixture from '../../../fixtures/ApplyCredit.json';
import sendEmailFixture from '../../../fixtures/SendEmail-success.json';
import updateTicketFixture from '../../../fixtures/UpdateTicket.json';

let whmcsServer: MockWhmcsServer;
let actions: ActionDomain;

// Capture registerTool calls
type Handler = (...args: any[]) => Promise<any>;
let registrations: Record<string, Handler>;
let mockMcpServer: { registerTool: ReturnType<typeof vi.fn> };

const ORIGINAL_MUTATIONS = process.env.WHMCS_ALLOW_MUTATIONS;

beforeAll(async () => {
  whmcsServer = await startMockWhmcs({
    fixtures: {
      ApplyCredit: applyCreditFixture,
      SendEmail: sendEmailFixture,
      UpdateTicket: updateTicketFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: whmcsServer.url + '/', identifier: 'id', secret: 'sec' });
  actions = new ActionDomain(client);
});
afterAll(async () => { await whmcsServer.stop(); });

beforeEach(() => {
  delete process.env.WHMCS_ALLOW_MUTATIONS;

  registrations = {};
  mockMcpServer = {
    registerTool: vi.fn((name: string, _opts: unknown, handler: Handler) => {
      registrations[name] = handler;
    }),
  };
});

afterEach(() => {
  if (ORIGINAL_MUTATIONS === undefined) delete process.env.WHMCS_ALLOW_MUTATIONS;
  else process.env.WHMCS_ALLOW_MUTATIONS = ORIGINAL_MUTATIONS;
});

function register(): void {
  registerActionTools(mockMcpServer as never, { actions });
}

describe('registerActionTools', () => {
  it('registers all 4 action tools', () => {
    register();
    const names = mockMcpServer.registerTool.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual([
      'whmcs_apply_credit',
      'whmcs_resend_welcome_email',
      'whmcs_send_invoice_reminder',
      'whmcs_update_ticket_status',
    ]);
  });

  it('whmcs_apply_credit is BLOCKED without WHMCS_ALLOW_MUTATIONS', async () => {
    delete process.env.WHMCS_ALLOW_MUTATIONS;
    register();
    const handler = registrations['whmcs_apply_credit'];
    const result = await handler({ invoiceId: 5001, amount: 10, confirm: true });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/WHMCS_ALLOW_MUTATIONS/);
  });

  it('whmcs_apply_credit is BLOCKED without confirm=true', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    register();
    const handler = registrations['whmcs_apply_credit'];
    const result = await handler({ invoiceId: 5001, amount: 10 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/confirm: true/);
  });

  it('whmcs_apply_credit works when both env flag set AND confirm=true', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    register();
    const handler = registrations['whmcs_apply_credit'];
    const result = await handler({ invoiceId: 5001, amount: 25.50, confirm: true });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toMatch(/Credit of 25\.5 applied to invoice #5001/);
  });

  it('whmcs_update_ticket_status works when mutation-gated correctly', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    register();
    const handler = registrations['whmcs_update_ticket_status'];
    const result = await handler({ ticketId: 8001, status: 'Closed', confirm: true });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toMatch(/Ticket #8001 status updated to Closed/);
  });

  it('whmcs_resend_welcome_email sends correct template', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    register();
    const handler = registrations['whmcs_resend_welcome_email'];
    const result = await handler({ serviceId: 100, confirm: true });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toMatch(/Product Welcome Email/);
  });

  it('whmcs_send_invoice_reminder sends correct template', async () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    register();
    const handler = registrations['whmcs_send_invoice_reminder'];
    const result = await handler({ invoiceId: 200, confirm: true });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).toMatch(/Invoice Payment Reminder/);
  });
});
