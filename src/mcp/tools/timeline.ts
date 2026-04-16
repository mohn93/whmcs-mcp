import type { TimelineDomain } from '../../whmcs/domains/timeline.js';
import type { Capabilities } from '../../whmcs/version.js';

export interface TimelineToolDeps {
  timeline: TimelineDomain;
  capabilities: Capabilities;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(obj: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
function fail(msg: string): ToolResult {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

export function registerTimelineTools(server: any, deps: TimelineToolDeps): void {
  server.registerTool(
    'whmcs_get_client_timeline',
    {
      title: 'Get Client Timeline',
      description: 'Returns a chronological timeline of all client events: orders, invoices, services, tickets, and domains — sorted newest-first.',
      inputSchema: {
        clientId: { type: 'number', description: 'The WHMCS client ID' },
      },
    },
    async ({ clientId }: { clientId: number }) => {
      try { return ok(await deps.timeline.getClientTimeline(clientId)); }
      catch (e) { return fail((e as Error).message); }
    },
  );

  server.registerTool(
    'whmcs_get_client_autoauth_url',
    {
      title: 'Get Client Auto-Auth URL',
      description: 'Returns a single-sign-on URL to log into the client area as this client (WHMCS 7.7+).',
      inputSchema: {
        clientId: { type: 'number', description: 'The WHMCS client ID' },
      },
    },
    async ({ clientId }: { clientId: number }) => {
      try { return ok(await deps.timeline.getClientAutoAuthUrl(clientId, deps.capabilities)); }
      catch (e) { return fail((e as Error).message); }
    },
  );
}
