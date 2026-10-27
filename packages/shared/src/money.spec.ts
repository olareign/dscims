import { describe, expect, it } from 'vitest';
import { formatNaira, nairaToKobo } from './money.js';

describe('money', () => {
  it('converts naira to integer kobo without float drift', () => {
    expect(nairaToKobo('1250.50')).toBe(125050);
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
    expect(nairaToKobo('-5')).toBe(-500);
  });
  it('rejects more than two decimals and junk', () => {
    expect(() => nairaToKobo('1.234')).toThrow(RangeError);
    expect(() => nairaToKobo('abc')).toThrow(RangeError);
  });
  it('formats kobo as naira with grouping', () => {
    expect(formatNaira(123456789)).toBe('₦1,234,567.89');
    expect(formatNaira(-5)).toBe('-₦0.05');
  });
  it('refuses fractional kobo', () => {
    expect(() => formatNaira(1.5)).toThrow(RangeError);
  });
});
