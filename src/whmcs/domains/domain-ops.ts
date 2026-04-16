import type { WhmcsClient } from '../client.js';

export interface DomainRecord {
  id: number;
  userid: number;
  domainname: string;
  regdate: string;
  expirydate: string;
  nextduedate: string;
  registrar: string;
  status: string;
}

export class DomainOpsDomain {
  constructor(private client: WhmcsClient) {}

  private async getAllDomains(): Promise<DomainRecord[]> {
    const res = await this.client.call<{
      domains: { domain: DomainRecord[] };
    }>('GetClientsDomains');
    return res.domains?.domain ?? [];
  }

  async getPendingTransfers(): Promise<DomainRecord[]> {
    const domains = await this.getAllDomains();
    return domains.filter((d) => d.status === 'Pending Transfer');
  }

  async getUpcomingRenewals(daysAhead: number = 30): Promise<DomainRecord[]> {
    const domains = await this.getAllDomains();
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return domains.filter((d) => {
      const expiry = new Date(d.expirydate);
      return expiry >= now && expiry <= cutoff;
    });
  }

  async getDomainDetails(domainId: number): Promise<DomainRecord> {
    const res = await this.client.call<{
      domains: { domain: DomainRecord[] };
    }>('GetClientsDomains', { domainid: domainId });
    const domain = res.domains?.domain?.find((d) => d.id === domainId);
    if (!domain) throw new Error(`Domain ${domainId} not found`);
    return domain;
  }
}
