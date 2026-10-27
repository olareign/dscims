import { describe, expect, it } from 'vitest';
import { auditListQuery, inviteUserInput, loginInput, password, userListQuery } from './schemas.js';

describe('schemas', () => {
  it('normalises emails and rejects phone numbers as login ids', () => {
    expect(loginInput.parse({ email: ' Ada@Example.NG ', password: 'x' }).email).toBe('ada@example.ng');
    expect(loginInput.safeParse({ email: '0803 123 4567', password: 'x' }).success).toBe(false);
  });
  it('enforces the password policy', () => {
    expect(password.safeParse('short1').success).toBe(false);
    expect(password.safeParse('onlyletterslong').success).toBe(false);
    expect(password.safeParse('Longenough123').success).toBe(true);
  });
  it('does not let an invite create an owner', () => {
    const base = { name: 'Ada Eze', email: 'ada@example.ng', shopId: '00000000-0000-4000-8000-000000000000' };
    expect(inviteUserInput.safeParse({ ...base, role: 'owner' }).success).toBe(false);
    expect(inviteUserInput.safeParse({ ...base, role: 'staff' }).success).toBe(true);
  });
  it('applies paging defaults and caps page size', () => {
    expect(userListQuery.parse({})).toMatchObject({ page: 1, pageSize: 10, sort: 'name' });
    expect(userListQuery.safeParse({ pageSize: '500' }).success).toBe(false);
  });
  it('validates audit date filters', () => {
    expect(auditListQuery.safeParse({ from: '27-10-2026' }).success).toBe(false);
    expect(auditListQuery.safeParse({ from: '2026-10-27' }).success).toBe(true);
  });
});
