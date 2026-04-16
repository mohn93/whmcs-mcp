import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { ProductDomain } from '../../../../src/whmcs/domains/products';
import { registerProductTools } from '../../../../src/mcp/tools/products';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';

import productsFixture from '../../../fixtures/GetProducts-full.json';
import groupsFixture from '../../../fixtures/GetProductGroups.json';
import clientProductsFixture from '../../../fixtures/GetClientsProducts-service.json';

type Handler = (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

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

function makeServer() {
  const handlers: Record<string, Handler> = {};
  const mcp = {
    registerTool: vi.fn((name: string, _schema: unknown, handler: Handler) => {
      handlers[name] = handler;
    }),
  };
  return { mcp, handlers };
}

describe('registerProductTools', () => {
  it('registers 3 product tools', () => {
    const { mcp } = makeServer();
    registerProductTools(mcp as never, { products });
    const names = mcp.registerTool.mock.calls.map((c: any) => c[0]);
    expect(names).toEqual([
      'whmcs_get_product_full',
      'whmcs_get_product_groups',
      'whmcs_get_client_addons',
    ]);
  });

  it('whmcs_get_product_full returns JSON with pricing', async () => {
    const { mcp, handlers } = makeServer();
    registerProductTools(mcp as never, { products });
    const out = await handlers['whmcs_get_product_full']({ productId: 5 });
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.pid).toBe(5);
    expect(parsed.name).toBe('Starter Hosting');
    expect(parsed.module).toBe('cpanel');
    expect(parsed.pricing.USD.monthly).toBe('10.00');
    expect(parsed.pricing.USD.annually).toBe('96.00');
  });

  it('whmcs_get_product_full returns error for missing product', async () => {
    server.setFixture('GetProducts', {
      result: 'success', totalresults: 0, products: { product: [] },
    });
    const { mcp, handlers } = makeServer();
    registerProductTools(mcp as never, { products });
    const out = await handlers['whmcs_get_product_full']({ productId: 999 });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/Product 999 not found/);
    // Restore fixture
    server.setFixture('GetProducts', productsFixture);
  });

  it('whmcs_get_product_groups returns groups', async () => {
    const { mcp, handlers } = makeServer();
    registerProductTools(mcp as never, { products });
    const out = await handlers['whmcs_get_product_groups']({});
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Web Hosting');
  });

  it('whmcs_get_client_addons returns simplified list', async () => {
    const { mcp, handlers } = makeServer();
    registerProductTools(mcp as never, { products });
    const out = await handlers['whmcs_get_client_addons']({ clientId: 42 });
    expect(out.isError).toBeUndefined();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Starter Hosting');
    expect(parsed[0].status).toBe('Pending');
  });
});
