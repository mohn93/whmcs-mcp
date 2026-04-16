export function mutationsEnabled(): boolean {
  return process.env.WHMCS_ALLOW_MUTATIONS === 'true';
}

export function requireMutations(toolName: string, confirm?: boolean): void {
  if (!mutationsEnabled()) {
    throw new Error(
      `${toolName} is a mutating tool and is disabled. Set WHMCS_ALLOW_MUTATIONS=true in the server environment to enable.`,
    );
  }
  if (confirm !== true) {
    throw new Error(
      `${toolName} requires explicit confirm: true in the call parameters to run.`,
    );
  }
}
