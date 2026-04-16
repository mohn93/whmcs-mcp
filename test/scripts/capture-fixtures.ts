import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { WhmcsClient } from '../../src/whmcs/client.js';
import { scrub } from './scrub.js';

async function main() {
  const [, , action, ...kv] = process.argv;
  if (!action) {
    console.error('Usage: tsx test/scripts/capture-fixtures.ts <Action> [key=value ...]');
    process.exit(2);
  }
  const params = Object.fromEntries(
    kv.map((pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) throw new Error(`Bad arg: ${pair}`);
      return [pair.slice(0, idx), pair.slice(idx + 1)];
    }),
  );
  const client = new WhmcsClient({
    apiUrl: required('WHMCS_API_URL'),
    identifier: required('WHMCS_API_IDENTIFIER'),
    secret: required('WHMCS_API_SECRET'),
    accesskey: process.env.WHMCS_ACCESS_KEY || undefined,
  });
  const response = await client.call(action, params);
  const scrubbed = scrub(response);
  const path = resolve('test/fixtures', `${action}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(scrubbed, null, 2) + '\n');
  console.log(`Wrote ${path}`);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

main().catch((err) => { console.error(err); process.exit(1); });
