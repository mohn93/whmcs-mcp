import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WhmcsClient } from '../../../src/whmcs/client';
import { probeCapabilities } from '../../../src/whmcs/version';
import { startMockWhmcs, type MockWhmcsServer } from '../../mock-whmcs';

let server: MockWhmcsServer;

beforeEach(async () => {
  server = await startMockWhmcs();
});
afterEach(async () => {
  await server.stop();
});

const clientFor = (mock: MockWhmcsServer) =>
  new WhmcsClient({ apiUrl: mock.url + '/', identifier: 'id', secret: 'sec' });

describe('probeCapabilities', () => {
  it('reports version and derives capability flags for WHMCS 8.x', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '8.11.0', canonicalversion: '8.11.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('8.11.0');
    expect(caps.major).toBe(8);
    expect(caps.hasModuleQueue).toBe(true);
    expect(caps.hasCreateSsoToken).toBe(true);
    expect(caps.hasGetCredits).toBe(true);
  });

  it('flags older WHMCS versions as lacking ModuleQueue', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '7.10.0', canonicalversion: '7.10.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.major).toBe(7);
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(true);
    expect(caps.hasGetCredits).toBe(true);
  });

  it('returns unknown capability set if WhmcsDetails itself is unsupported', async () => {
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('unknown');
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(false);
    expect(caps.hasGetCredits).toBe(false);
  });

  it('WHMCS 7.0 — below all thresholds: no ModuleQueue, no SSO, no Credits', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '7.0.0', canonicalversion: '7.0.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('7.0.0');
    expect(caps.major).toBe(7);
    expect(caps.minor).toBe(0);
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(false);
    expect(caps.hasGetCredits).toBe(false);
  });

  it('WHMCS 7.6 — has Credits (>=7.1) but not SSO (requires >=7.7)', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '7.6.0', canonicalversion: '7.6.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('7.6.0');
    expect(caps.major).toBe(7);
    expect(caps.minor).toBe(6);
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(false);
    expect(caps.hasGetCredits).toBe(true);
  });

  it('malformed version string (e.g. "abc") falls back to zero capabilities', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: 'abc' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('abc');
    expect(caps.major).toBe(0);
    expect(caps.minor).toBe(0);
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(false);
    expect(caps.hasGetCredits).toBe(false);
  });

  it('version "8.0.0" boundary — ModuleQueue = true, SSO = true, Credits = true', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '8.0.0', canonicalversion: '8.0.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.version).toBe('8.0.0');
    expect(caps.major).toBe(8);
    expect(caps.minor).toBe(0);
    expect(caps.hasModuleQueue).toBe(true);
    expect(caps.hasCreateSsoToken).toBe(true);
    expect(caps.hasGetCredits).toBe(true);
  });

  it('WHMCS 7.7 boundary — SSO = true, Credits = true, ModuleQueue = false', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '7.7.0', canonicalversion: '7.7.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.major).toBe(7);
    expect(caps.minor).toBe(7);
    expect(caps.hasModuleQueue).toBe(false);
    expect(caps.hasCreateSsoToken).toBe(true);
    expect(caps.hasGetCredits).toBe(true);
  });

  it('WHMCS 7.1 boundary — Credits = true, SSO = false', async () => {
    server.setFixture('WhmcsDetails', {
      result: 'success',
      whmcs: { version: '7.1.0', canonicalversion: '7.1.0-release.1' },
    });
    const caps = await probeCapabilities(clientFor(server));
    expect(caps.major).toBe(7);
    expect(caps.minor).toBe(1);
    expect(caps.hasGetCredits).toBe(true);
    expect(caps.hasCreateSsoToken).toBe(false);
    expect(caps.hasModuleQueue).toBe(false);
  });
});
