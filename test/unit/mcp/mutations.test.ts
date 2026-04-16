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
});
