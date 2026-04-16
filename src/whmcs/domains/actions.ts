import type { WhmcsClient } from '../client.js';

export class ActionDomain {
  constructor(private client: WhmcsClient) {}

  async applyCreditToInvoice(invoiceId: number, amount: number, noemail?: boolean): Promise<{ message: string }> {
    const res = await this.client.call<{ invoiceid: number }>('ApplyCredit', {
      invoiceid: invoiceId,
      amount,
      noemail: noemail ?? false,
    });
    return { message: `Credit of ${amount} applied to invoice #${res.invoiceid}` };
  }

  async sendEmail(params: {
    id: number;
    messagename: string;
    customvars?: string;
  }): Promise<{ message: string }> {
    await this.client.call('SendEmail', params);
    return { message: `Email "${params.messagename}" sent successfully` };
  }

  async updateTicketStatus(ticketId: number, status: string, message?: string): Promise<{ message: string }> {
    await this.client.call('UpdateTicket', {
      ticketid: ticketId,
      status,
      ...(message ? { message } : {}),
    });
    return { message: `Ticket #${ticketId} status updated to ${status}` };
  }
}
