import { describe, it, expect } from 'vitest';
import { scrub } from '../../../test/scripts/scrub';

describe('scrub', () => {
  it('replaces email addresses with deterministic placeholders', () => {
    const input = { email: 'jane@real.com', notes: 'cc: bob@acme.co' };
    const out = scrub(input) as typeof input;
    expect(out.email).toMatch(/^client\d+@example\.test$/);
    expect(out.notes).toMatch(/cc: client\d+@example\.test/);
  });

  it('blanks first/last name, address1/2, phonenumber', () => {
    const input = {
      firstname: 'Jane', lastname: 'Doe',
      address1: '1 Main St', address2: 'Apt 4',
      phonenumber: '+218 91 1234567',
    };
    const out = scrub(input) as typeof input;
    expect(out.firstname).toBe('REDACTED');
    expect(out.lastname).toBe('REDACTED');
    expect(out.address1).toBe('REDACTED');
    expect(out.address2).toBe('REDACTED');
    expect(out.phonenumber).toBe('REDACTED');
  });

  it('recurses into arrays and nested objects', () => {
    const input = { clients: [{ email: 'a@b.com', deep: { email: 'c@d.com' } }] };
    const out = scrub(input) as { clients: Array<{ email: string; deep: { email: string } }> };
    expect(out.clients[0].email).toMatch(/^client\d+@example\.test$/);
    expect(out.clients[0].deep.email).toMatch(/^client\d+@example\.test$/);
  });

  it('leaves numbers, booleans, and non-PII strings alone', () => {
    const input = { id: 42, active: true, currency: 'USD' };
    expect(scrub(input)).toEqual(input);
  });
});
