import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ProductDomain } from '../../../../src/whmcs/domains/products';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import productsFixture from '../../../fixtures/GetProducts-full.json';
import groupsFixture from '../../../fixtures/GetProductGroups.json';
import clientProductsFixture from '../../../fixtures/GetClientsProducts-service.json';

let server: MockWhmcsServer;
let products: ProductDomain;

beforeAll(async () => {
  server = await startMockWhmcs({
    fixtures: {
      GetProducts: productsFixture,
      GetProductGroups: groupsFixture,
      GetClientsProducts: clientProductsFixture,
    },
  });
  const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
  products = new ProductDomain(client);
});
afterAll(async () => { await server.stop(); });

describe('ProductDomain.getProductFull', () => {
  it('returns enriched product with pricing, module, and group', async () => {
    const p = await products.getProductFull(5);
    expect(p.pid).toBe(5);
    expect(p.name).toBe('Starter Hosting');
    expect(p.module).toBe('cpanel');
    expect(p.pricing.USD.monthly).toBe('10.00');
    expect(p.pricing.USD.annually).toBe('96.00');
    expect(p.gid).toBe(1);
  });

  it('sends pid filter to WHMCS', async () => {
    await products.getProductFull(5);
    expect(server.lastRequest()?.params.get('action')).toBe('GetProducts');
    expect(server.lastRequest()?.params.get('pid')).toBe('5');
  });

  it('throws when product is not found', async () => {
    server.setFixture('GetProducts', {
      result: 'success', totalresults: 0, products: { product: [] },
    });
    await expect(products.getProductFull(999)).rejects.toThrow(/Product 999 not found/);
    // Restore original fixture
    server.setFixture('GetProducts', productsFixture);
  });

  it('returns pricing with all cycle fields', async () => {
    const p = await products.getProductFull(5);
    const usd = p.pricing.USD;
    expect(usd.monthly).toBe('10.00');
    expect(usd.quarterly).toBe('27.00');
    expect(usd.semiannually).toBe('50.00');
    expect(usd.annually).toBe('96.00');
    expect(usd.biennially).toBe('180.00');
    expect(usd.triennially).toBe('252.00');
    expect(usd.prefix).toBe('$');
    expect(usd.msetupfee).toBe('5.00');
    expect(usd.asetupfee).toBe('0.00');
  });
});

describe('ProductDomain.getProductGroups', () => {
  it('returns array of product groups', async () => {
    const groups = await products.getProductGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(1);
    expect(groups[0].name).toBe('Web Hosting');
    expect(groups[0].headline).toBe('Hosting Plans');
  });

  it('calls GetProductGroups action', async () => {
    await products.getProductGroups();
    expect(server.lastRequest()?.params.get('action')).toBe('GetProductGroups');
  });

  it('returns empty array when no product groups exist', async () => {
    server.setFixture('GetProductGroups', {
      result: 'success', productgroups: { productgroup: [] },
    });
    const groups = await products.getProductGroups();
    expect(groups).toHaveLength(0);
    expect(groups).toEqual([]);
    // Restore
    server.setFixture('GetProductGroups', groupsFixture);
  });
});

describe('ProductDomain.getClientAddons', () => {
  it('returns simplified list of client products', async () => {
    const addons = await products.getClientAddons(42);
    expect(addons).toHaveLength(1);
    expect(addons[0]).toEqual({
      id: 1001,
      name: 'Starter Hosting',
      domain: 'example.test',
      status: 'Pending',
      billingcycle: 'Monthly',
      recurringamount: '10.00',
    });
  });

  it('sends clientid filter to WHMCS', async () => {
    await products.getClientAddons(42);
    expect(server.lastRequest()?.params.get('action')).toBe('GetClientsProducts');
    expect(server.lastRequest()?.params.get('clientid')).toBe('42');
  });

  it('returns empty array when client has no products', async () => {
    server.setFixture('GetClientsProducts', {
      result: 'success', totalresults: 0, products: { product: [] },
    });
    const addons = await products.getClientAddons(42);
    expect(addons).toHaveLength(0);
    expect(addons).toEqual([]);
    // Restore
    server.setFixture('GetClientsProducts', clientProductsFixture);
  });
});
