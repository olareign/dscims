import { describe, expect, it } from 'vitest';
import { accessFor, CAPABILITIES, ROLES } from './roles.js';
import { isSellable } from './device.js';

describe('role matrix', () => {
  it('defines every capability for every role', () => {
    for (const c of CAPABILITIES) for (const r of ROLES) expect(['Y', 'N', 'A']).toContain(accessFor(r, c));
  });
  it('keeps cost and profit owner-only (AUTH-3)', () => {
    expect(accessFor('owner', 'finance.cost_and_profit')).toBe('Y');
    expect(accessFor('manager', 'finance.cost_and_profit')).toBe('N');
    expect(accessFor('staff', 'finance.cost_and_profit')).toBe('N');
  });
  it('lets only the owner resolve flags (INV-8)', () => {
    expect(ROLES.filter((r) => accessFor(r, 'flag.resolve') === 'Y')).toEqual(['owner']);
  });
});

describe('isSellable', () => {
  it('allows only in_stock devices', () => {
    expect(isSellable('in_stock')).toBe(true);
    expect(isSellable('flagged')).toBe(false);
    expect(isSellable('reserved')).toBe(false);
  });
});
