const PII_KEYS = new Set([
  'firstname', 'lastname', 'fullname', 'companyname',
  'address1', 'address2', 'postcode', 'phonenumber',
  'tax_id', 'taxid', 'vat',
]);
const EMAIL_RE = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;

export function scrub(value: unknown, counters: { email: number } = { email: 0 }): unknown {
  if (Array.isArray(value)) return value.map((v) => scrub(v, counters));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase()) && typeof v === 'string') {
        out[k] = 'REDACTED';
      } else {
        out[k] = scrub(v, counters);
      }
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.replace(EMAIL_RE, () => `client${++counters.email}@example.test`);
  }
  return value;
}
