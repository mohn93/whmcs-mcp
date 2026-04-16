import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireMutations, mutationsEnabled } from '../../../src/mcp/mutations';

const ORIGINAL = process.env.WHMCS_ALLOW_MUTATIONS;

beforeEach(() => { delete process.env.WHMCS_ALLOW_MUTATIONS; });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.WHMCS_ALLOW_MUTATIONS;
  else process.env.WHMCS_ALLOW_MUTATIONS = ORIGINAL;
});

describe('mutation gating', () => {
  it('is disabled by default', () => {
    expect(mutationsEnabled()).toBe(false);
  });

  it('is enabled when env flag is exactly "true"', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(mutationsEnabled()).toBe(true);
  });

  it('is NOT enabled by "1", "yes", or other truthy strings', () => {
    for (const v of ['1', 'yes', 'TRUE', 'on']) {
      process.env.WHMCS_ALLOW_MUTATIONS = v;
      expect(mutationsEnabled()).toBe(false);
    }
  });

  it('requireMutations throws when disabled, with actionable message', () => {
    expect(() => requireMutations('whmcs_resync_service')).toThrow(/WHMCS_ALLOW_MUTATIONS/);
  });

  it('requireMutations throws when confirm is not true', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(() => requireMutations('whmcs_resync_service', false)).toThrow(/confirm: true/);
  });

  it('requireMutations passes when enabled and confirmed', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(() => requireMutations('whmcs_resync_service', true)).not.toThrow();
  });

  it('error message includes the tool name when mutations are disabled', () => {
    expect(() => requireMutations('whmcs_apply_credit')).toThrow(/whmcs_apply_credit/);
  });

  it('error message includes the tool name when confirm is not true', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(() => requireMutations('whmcs_send_email', false)).toThrow(/whmcs_send_email/);
  });

  it('confirm = undefined is treated same as false (requires confirmation)', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = 'true';
    expect(() => requireMutations('whmcs_update_ticket', undefined)).toThrow(/confirm: true/);
  });

  it('confirm = undefined when mutations disabled throws about WHMCS_ALLOW_MUTATIONS', () => {
    expect(() => requireMutations('whmcs_resync_service', undefined)).toThrow(/WHMCS_ALLOW_MUTATIONS/);
  });

  it('is disabled when env var is empty string', () => {
    process.env.WHMCS_ALLOW_MUTATIONS = '';
    expect(mutationsEnabled()).toBe(false);
  });
});
