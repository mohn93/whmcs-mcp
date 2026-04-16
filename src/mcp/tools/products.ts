import { z } from 'zod';
import type { ProductDomain } from '../../whmcs/domains/products.js';

export interface ProductToolDeps {
  products: ProductDomain;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

export function registerProductTools(server: any, deps: ProductToolDeps): void {
  server.registerTool(
    'whmcs_get_product_full',
    {
      title: 'Get Product Full',
      description:
        'Returns enriched product details including pricing tiers, module, server group, and pay type for a specific WHMCS product.',
      inputSchema: {
        productId: z.number().describe('The WHMCS product ID (pid)'),
      },
    },
    async ({ productId }: { productId: number }) => {
      try { return ok(await deps.products.getProductFull(productId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_product_groups',
    {
      title: 'Get Product Groups',
      description:
        'Returns all WHMCS product groups with their names, headlines, and taglines.',
      inputSchema: {},
    },
    async () => {
      try { return ok(await deps.products.getProductGroups()); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_client_addons',
    {
      title: 'Get Client Addons',
      description:
        'Returns a simplified list of products/services for a client, including status, billing cycle, and recurring amount.',
      inputSchema: {
        clientId: z.number().describe('The WHMCS client ID'),
        limit: z.number().optional().describe('Max products to return (default 25)'),
      },
    },
    async ({ clientId, limit }: { clientId: number; limit?: number }) => {
      try { return ok(await deps.products.getClientAddons(clientId, { limit })); }
      catch (e) { return fail((e as Error).message); }
    },
  );
}
