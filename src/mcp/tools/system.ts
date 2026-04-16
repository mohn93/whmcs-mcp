import type { SystemDomain } from '../../whmcs/domains/system.js';

export interface SystemToolDeps {
  system: SystemDomain;
}

/**
 * Registers MCP tools for the WHMCS system domain.
 *
 * Uses the `server.registerTool()` API from `@modelcontextprotocol/sdk`.
 */
export function registerSystemTools(server: any, deps: SystemToolDeps): void {
  server.registerTool(
    'whmcs_get_stats',
    {
      title: 'Get Stats',
      description:
        'Returns WHMCS dashboard statistics including income totals, pending orders, unpaid invoices, and tickets awaiting reply.',
      inputSchema: {},
    },
    async () => {
      const stats = await deps.system.getStats();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }],
      };
    },
  );
}
