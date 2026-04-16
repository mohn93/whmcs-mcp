import { z } from 'zod';
import type { DomainOpsDomain } from '../../whmcs/domains/domain-ops.js';

export interface DomainOpsToolDeps {
  domainOps: DomainOpsDomain;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

export function registerDomainOpsTools(server: any, deps: DomainOpsToolDeps): void {
  server.registerTool(
    'whmcs_get_pending_transfers',
    {
      title: 'Get Pending Transfers',
      description:
        'Returns all domains currently in "Pending Transfer" status.',
      inputSchema: {},
    },
    async () => {
      try { return ok(await deps.domainOps.getPendingTransfers()); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_upcoming_renewals',
    {
      title: 'Get Upcoming Renewals',
      description:
        'Returns domains expiring within the specified number of days ahead.',
      inputSchema: {
        daysAhead: z.number().optional().describe('Number of days to look ahead (default 30)'),
      },
    },
    async ({ daysAhead }: { daysAhead?: number }) => {
      try { return ok(await deps.domainOps.getUpcomingRenewals(daysAhead)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_domain_details',
    {
      title: 'Get Domain Details',
      description:
        'Returns the full domain record for a specific domain ID.',
      inputSchema: {
        domainId: z.number().describe('The WHMCS domain ID'),
      },
    },
    async ({ domainId }: { domainId: number }) => {
      try { return ok(await deps.domainOps.getDomainDetails(domainId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );
}
