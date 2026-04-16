import type { ProvisioningDomain } from '../../whmcs/domains/provisioning.js';
import type { Capabilities } from '../../whmcs/version.js';
import { requireMutations } from '../mutations.js';

export interface ProvisioningToolDeps {
  provisioning: ProvisioningDomain;
  capabilities: Capabilities;
}

/**
 * Registers MCP tools for the WHMCS provisioning/ops-forensics domain.
 *
 * Uses the `server.registerTool()` API from `@modelcontextprotocol/sdk`.
 */
export function registerProvisioningTools(server: any, deps: ProvisioningToolDeps): void {
  // ── Read-only tools ──────────────────────────────────────────────

  server.registerTool(
    'whmcs_get_service_details',
    {
      title: 'Get Service Details',
      description:
        'Returns detailed information about a WHMCS hosting service/product, including server assignment, billing cycle, and current status.',
      inputSchema: {
        serviceId: { type: 'number', description: 'The WHMCS service/product ID' },
      },
    },
    async ({ serviceId }: { serviceId: number }) => {
      try {
        const result = await deps.provisioning.getServiceDetails(serviceId);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_get_module_log',
    {
      title: 'Get Module Log',
      description:
        'Returns activity-log entries related to provisioning module actions for a specific service.',
      inputSchema: {
        serviceId: { type: 'number', description: 'The WHMCS service/product ID' },
        limit: { type: 'number', description: 'Maximum number of log entries to return (default 50)' },
      },
    },
    async ({ serviceId, limit }: { serviceId: number; limit?: number }) => {
      try {
        const result = await deps.provisioning.getModuleLog(serviceId, { limit });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_get_module_queue',
    {
      title: 'Get Module Queue',
      description:
        'Returns the WHMCS module command queue — failed provisioning actions awaiting retry. Requires WHMCS 8.0+.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await deps.provisioning.getModuleQueue(deps.capabilities);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_get_server_usage',
    {
      title: 'Get Server Usage',
      description:
        'Returns per-server utilization statistics including account counts, capacity, percent used, and headroom.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await deps.provisioning.getServerUsage();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_get_services_by_server',
    {
      title: 'Get Services by Server',
      description:
        'Returns all services hosted on a specific server, with their statuses. Use with whmcs_get_server_usage to investigate a server.',
      inputSchema: {
        serverId: { type: 'number', description: 'The WHMCS server ID' },
      },
    },
    async ({ serverId }: { serverId: number }) => {
      try {
        const result = await deps.provisioning.getServicesByServer(serverId);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_get_module_debug_log',
    {
      title: 'Get Module Debug Log',
      description:
        'Returns raw module debug log entries (request/response payloads) when available (WHMCS 8.x), or falls back to activity log module entries. Use to debug provisioning API failures.',
      inputSchema: {
        serviceId: { type: 'number', description: 'Optional WHMCS service/product ID to filter by' },
        module: { type: 'string', description: 'Optional module name to filter by (e.g. "cpanel")' },
        limit: { type: 'number', description: 'Maximum number of log entries to return (default 50)' },
      },
    },
    async ({ serviceId, module, limit }: { serviceId?: number; module?: string; limit?: number }) => {
      try {
        const result = await deps.provisioning.getModuleDebugLog({ serviceId, module, limit });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'whmcs_get_server_modules',
    {
      title: 'Get Server Modules',
      description:
        'Returns provisioning modules with their assigned servers, capacity totals, and utilization. Shows which modules (cPanel, Plesk, etc.) are configured and how loaded they are.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await deps.provisioning.getServerModules();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );

  // ── Mutating tool (guarded) ──────────────────────────────────────

  server.registerTool(
    'whmcs_resync_service',
    {
      title: 'Resync Service',
      description:
        'Re-runs a provisioning module command (Create, Suspend, Unsuspend, Terminate, ChangePackage, ChangePassword) for a service. ' +
        'This is a MUTATING action — requires WHMCS_ALLOW_MUTATIONS=true and confirm: true.',
      inputSchema: {
        serviceId: { type: 'number', description: 'The WHMCS service/product ID' },
        action: {
          type: 'string',
          description: 'Module action to run (default: Create)',
          enum: ['Create', 'Suspend', 'Unsuspend', 'Terminate', 'ChangePackage', 'ChangePassword'],
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm the mutating operation',
        },
      },
    },
    async ({ serviceId, action, confirm }: { serviceId: number; action?: string; confirm?: boolean }) => {
      try {
        requireMutations('whmcs_resync_service', confirm);
        const result = await deps.provisioning.resyncService(serviceId, action as any);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: (err as Error).message }],
          isError: true,
        };
      }
    },
  );
}
