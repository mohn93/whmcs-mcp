import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ActionDomain } from '../../../../src/whmcs/domains/actions';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import applyCreditFixture from '../../../fixtures/ApplyCredit.json';
import sendEmailFixture from '../../../fixtures/SendEmail-success.json';
import updateTicketFixture from '../../../fixtures/UpdateTicket.json';

let server: MockWhmcsServer;
let actions: ActionDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      ApplyCredit: applyCreditFixture,
      SendEmail: sendEmailFixture,
      UpdateTicket: updateTicketFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  actions = new ActionDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('ActionDomain.applyCreditToInvoice', () => {
  it('returns success message with invoice ID', async () => {
    const result = await actions.applyCreditToInvoice(5001, 25.50);
    expect(result.message).toBe('Credit of 25.5 applied to invoice #5001');
  });

  it('sends correct params to WHMCS', async () => {
    await actions.applyCreditToInvoice(5001, 10, true);
    const last = server.lastRequest()!;
    expect(last.params.get('action')).toBe('ApplyCredit');
    expect(last.params.get('invoiceid')).toBe('5001');
    expect(last.params.get('amount')).toBe('10');
    expect(last.params.get('noemail')).toBe('true');
  });

  it('defaults noemail to false', async () => {
    await actions.applyCreditToInvoice(5001, 10);
    const last = server.lastRequest()!;
    expect(last.params.get('noemail')).toBe('false');
  });
});

describe('ActionDomain.sendEmail', () => {
  it('sends correct template name', async () => {
    const result = await actions.sendEmail({ id: 100, messagename: 'Product Welcome Email' });
    expect(result.message).toBe('Email "Product Welcome Email" sent successfully');
  });

  it('passes params to WHMCS API', async () => {
    await actions.sendEmail({ id: 200, messagename: 'Invoice Payment Reminder', customvars: 'abc123' });
    const last = server.lastRequest()!;
    expect(last.params.get('action')).toBe('SendEmail');
    expect(last.params.get('id')).toBe('200');
    expect(last.params.get('messagename')).toBe('Invoice Payment Reminder');
    expect(last.params.get('customvars')).toBe('abc123');
  });
});

describe('ActionDomain.updateTicketStatus', () => {
  it('returns success message with ticket ID and status', async () => {
    const result = await actions.updateTicketStatus(8001, 'Closed');
    expect(result.message).toBe('Ticket #8001 status updated to Closed');
  });

  it('sends correct params to WHMCS', async () => {
    await actions.updateTicketStatus(8001, 'In Progress', 'Working on it');
    const last = server.lastRequest()!;
    expect(last.params.get('action')).toBe('UpdateTicket');
    expect(last.params.get('ticketid')).toBe('8001');
    expect(last.params.get('status')).toBe('In Progress');
    expect(last.params.get('message')).toBe('Working on it');
  });

  it('omits message param when not provided', async () => {
    await actions.updateTicketStatus(8001, 'Open');
    const last = server.lastRequest()!;
    expect(last.params.get('message')).toBeNull();
  });
});
