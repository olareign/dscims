import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDateTimeZone, formatTime } from './time.js';

describe('time formatting', () => {
  it('shows Lagos time with AM or PM, day, month and year', () => {
    expect(formatDateTime('2026-10-27T08:12:00Z')).toBe('27 Oct 2026, 9:12 AM');
    expect(formatDateTimeZone('2026-10-26T16:30:00Z')).toBe('26 Oct 2026, 5:30 PM WAT');
  });
  it('handles noon and midnight', () => {
    expect(formatTime('2026-10-27T11:00:00Z')).toBe('12:00 PM');
    expect(formatTime('2026-10-26T23:05:00Z')).toBe('12:05 AM');
  });
  it('crosses the date line into the next Lagos day', () => {
    expect(formatDate('2026-12-31T23:30:00Z')).toBe('1 Jan 2027');
  });
  it('rejects invalid dates', () => {
    expect(() => formatDate('nope')).toThrow(RangeError);
  });
});
