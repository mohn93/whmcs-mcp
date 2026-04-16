import type { HealthDomain } from '../../whmcs/domains/health.js';
import type { Capabilities } from '../../whmcs/version.js';

export interface HealthToolDeps {
  health: HealthDomain;
  capabilities: Capabilities;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

/**
 * Registers MCP tools for WHMCS health/integrity checks.
 */
export function registerHealthTools(server: any, deps: HealthToolDeps): void {
  server.registerTool(
    'whmcs_get_health_summary',
    {
      title: 'Get Health Summary',
      description:
        'Aggregates WHMCS system health: income/overdue stats, server utilization (flags servers at >=90% capacity), and module queue depth.',
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await deps.health.getHealthSummary(deps.capabilities));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.registerTool(
    'whmcs_find_inconsistencies',
    {
      title: 'Find Inconsistencies',
      description:
        'Scans for data integrity issues: invoices overdue more than 90 days and services stuck in Pending status for more than 7 days.',
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await deps.health.findInconsistencies());
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
