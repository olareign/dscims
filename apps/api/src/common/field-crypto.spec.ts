import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config.js';
import { FieldCrypto } from './field-crypto.js';

const crypto = (key?: string) => new FieldCrypto({ env: { FIELD_ENCRYPTION_KEY: key } } as AppConfig);

describe('FieldCrypto', () => {
  it('round-trips a value and never stores it readable', () => {
    const c = crypto('k'.repeat(40));
    const stored = c.encrypt('12345678901');
    expect(stored).not.toContain('12345678901');
    expect(c.decrypt(stored)).toBe('12345678901');
  });
  it('uses a fresh IV each time', () => {
    const c = crypto('k'.repeat(40));
    expect(c.encrypt('12345678901')).not.toBe(c.encrypt('12345678901'));
  });
  it('fails loudly with the wrong key or a tampered value', () => {
    const stored = crypto('a'.repeat(40)).encrypt('12345678901');
    expect(() => crypto('b'.repeat(40)).decrypt(stored)).toThrow();
    expect(() => crypto('a'.repeat(40)).decrypt(stored.slice(0, -2) + 'AA')).toThrow();
    expect(() => crypto('a'.repeat(40)).decrypt('garbage')).toThrow();
  });
});
