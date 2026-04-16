import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { DomainOpsDomain } from '../../../../src/whmcs/domains/domain-ops';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import domainsFixture from '../../../fixtures/GetClientsDomains-all.json';

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

describe('DomainOpsDomain.getPendingTransfers', () => {
  it('returns only domains with Pending Transfer status', async () => {
    const transfers = await domainOps.getPendingTransfers();
    expect(transfers).toHaveLength(1);
    expect(transfers[0].domainname).toBe('transfer.test');
    expect(transfers[0].status).toBe('Pending Transfer');
  });

  it('calls GetClientsDomains action', async () => {
    await domainOps.getPendingTransfers();
    expect(server.lastRequest()?.params.get('action')).toBe('GetClientsDomains');
  });

  it('returns empty array when no domains have Pending Transfer status', async () => {
    server.setFixture('GetClientsDomains', {
      result: 'success', totalresults: 1,
      domains: {
        domain: [
          { id: 301, userid: 42, domainname: 'example.test', regdate: '2025-01-15', expirydate: '2026-01-15', nextduedate: '2026-01-15', registrar: 'enom', status: 'Active' },
        ],
      },
    });
    const transfers = await domainOps.getPendingTransfers();
    expect(transfers).toHaveLength(0);
    // Restore
    server.setFixture('GetClientsDomains', domainsFixture);
  });
});

describe('DomainOpsDomain.getUpcomingRenewals', () => {
  it('returns domains expiring within the specified window', async () => {
    const renewals = await domainOps.getUpcomingRenewals(365);
    expect(renewals.length).toBeGreaterThanOrEqual(1);
    const names = renewals.map((d) => d.domainname);
    expect(names).toContain('expiring.test');
  });

  it('excludes domains outside the window', async () => {
    const renewals = await domainOps.getUpcomingRenewals(1);
    const names = renewals.map((d) => d.domainname);
    expect(names).not.toContain('expiring.test');
  });

  it('returns nothing with daysAhead=0 (zero-width window)', async () => {
    const renewals = await domainOps.getUpcomingRenewals(0);
    expect(renewals).toHaveLength(0);
  });
});

describe('DomainOpsDomain.getDomainDetails', () => {
  it('returns the domain record matching the given ID', async () => {
    const domain = await domainOps.getDomainDetails(301);
    expect(domain.id).toBe(301);
    expect(domain.domainname).toBe('example.test');
    expect(domain.registrar).toBe('enom');
  });

  it('throws when domain is not found', async () => {
    server.setFixture('GetClientsDomains', {
      result: 'success', totalresults: 0, domains: { domain: [] },
    });
    await expect(domainOps.getDomainDetails(999)).rejects.toThrow(/Domain 999 not found/);
    // Restore original fixture
    server.setFixture('GetClientsDomains', domainsFixture);
  });

  it('sends domainid filter to WHMCS', async () => {
    await domainOps.getDomainDetails(301);
    expect(server.lastRequest()?.params.get('action')).toBe('GetClientsDomains');
    expect(server.lastRequest()?.params.get('domainid')).toBe('301');
  });

  it('returns full domain record with all fields', async () => {
    const domain = await domainOps.getDomainDetails(301);
    expect(domain.userid).toBe(42);
    expect(domain.regdate).toBe('2025-01-15');
    expect(domain.expirydate).toBe('2026-01-15');
    expect(domain.nextduedate).toBe('2026-01-15');
    expect(domain.status).toBe('Active');
  });
});
