import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { WhmcsClient } from '../../../../src/whmcs/client';
import { SystemDomain } from '../../../../src/whmcs/domains/system';
import { registerSystemTools } from '../../../../src/mcp/tools/system';
import { startMockWhmcs, type MockWhmcsServer } from '../../../mock-whmcs';
import fixture from '../../../fixtures/GetStats.json';

let server: MockWhmcsServer;

beforeAll(async () => {
  server = await startMockWhmcs({ fixtures: { GetStats: fixture } });
});
afterAll(async () => { await server.stop(); });

describe('registerSystemTools', () => {
  it('registers whmcs_get_stats and invokes the domain method', async () => {
    const client = new WhmcsClient({ apiUrl: server.url + '/', identifier: 'id', secret: 'sec' });
    const system = new SystemDomain(client);

    // Mock the McpServer — matches actual API: server.registerTool(name, opts, handler)
    const registrations: Record<string, Function> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _opts: unknown, handler: Function) => {
        registrations[name] = handler;
      }),
    };

    registerSystemTools(mockServer as never, { system });

    // Verify registration happened
    expect(mockServer.registerTool).toHaveBeenCalled();

    // Find the handler and invoke it
    const handler = registrations['whmcs_get_stats'];
    expect(handler).toBeDefined();

    const result = await handler({});
    expect(result).toMatchObject({
      content: [{ type: 'text', text: expect.stringContaining('"income_today"') }],
    });
  });
});
