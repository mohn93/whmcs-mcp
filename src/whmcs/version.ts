import type { WhmcsClient } from './client.js';

export interface Capabilities {
  version: string;
  major: number;
  minor: number;
  hasModuleQueue: boolean;
  hasCreateSsoToken: boolean;
  hasGetCredits: boolean;
}

export async function probeCapabilities(client: WhmcsClient): Promise<Capabilities> {
  try {
    const res = await client.call<{ whmcs: { version: string } }>('WhmcsDetails');
    const version = res.whmcs?.version ?? 'unknown';
    const match = /^(\d+)\.(\d+)/.exec(version);
    const major = match ? Number(match[1]) : 0;
    const minor = match ? Number(match[2]) : 0;
    return {
      version,
      major,
      minor,
      hasModuleQueue: major >= 8,
      hasCreateSsoToken: major > 7 || (major === 7 && minor >= 7),
      hasGetCredits: major > 7 || (major === 7 && minor >= 1),
    };
  } catch {
    return {
      version: 'unknown',
      major: 0,
      minor: 0,
      hasModuleQueue: false,
      hasCreateSsoToken: false,
      hasGetCredits: false,
    };
  }
}
