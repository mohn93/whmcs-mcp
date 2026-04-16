import { describe, it, expect, vi } from 'vitest';
import { registerInvestigativePrompts } from '../../../../src/mcp/prompts/investigate';

type PromptHandler = (args: Record<string, string>) => { messages: Array<{ role: string; content: { type: string; text: string } }> };

function makeServer() {
  const handlers: Record<string, PromptHandler> = {};
  const mcp = {
    registerPrompt: vi.fn((name: string, _schema: unknown, handler: PromptHandler) => {
      handlers[name] = handler;
    }),
  };
  return { mcp, handlers };
}

describe('registerInvestigativePrompts', () => {
  it('registers 4 investigative prompts', () => {
    const { mcp } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const names = mcp.registerPrompt.mock.calls.map((c: any) => c[0]);
    expect(names).toHaveLength(4);
    expect(names).toContain('investigate-service');
    expect(names).toContain('investigate-invoice');
    expect(names).toContain('client-incident-triage');
    expect(names).toContain('audit-product');
  });

  it('investigate-service prompt instructs to use provisioning tools', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['investigate-service']({ serviceId: '1001' });
    const text = result.messages[0].content.text;
    expect(text).toContain('1001');
    expect(text).toContain('whmcs_get_service_details');
    expect(text).toContain('whmcs_get_module_log');
  });

  it('investigate-invoice prompt instructs to use invoice tools', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['investigate-invoice']({ invoiceId: '5001' });
    const text = result.messages[0].content.text;
    expect(text).toContain('5001');
    expect(text).toContain('whmcs_get_invoice_audit');
    expect(text).toContain('whmcs_get_payment_attempts');
  });

  it('client-incident-triage prompt instructs to use timeline', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['client-incident-triage']({ clientId: '42' });
    const text = result.messages[0].content.text;
    expect(text).toContain('42');
    expect(text).toContain('whmcs_get_client_timeline');
  });

  it('audit-product prompt references product and server tools', () => {
    const { mcp, handlers } = makeServer();
    registerInvestigativePrompts(mcp as never);
    const result = handlers['audit-product']({ productId: '5' });
    const text = result.messages[0].content.text;
    expect(text).toContain('5');
    expect(text).toContain('whmcs_get_server_usage');
  });
});
