import { describe, expect, it } from 'vitest';
import { pageWindow, paginated } from './pagination.js';

describe('pagination', () => {
  it('computes total pages with a minimum of one', () => {
    expect(paginated([], 0, 1, 10).totalPages).toBe(1);
    expect(paginated([], 24, 1, 10).totalPages).toBe(3);
  });
  it('shows every page when there are few', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });
  it('collapses long ranges with gaps', () => {
    expect(pageWindow(1, 15)).toEqual([1, 2, null, 14, 15]);
    expect(pageWindow(8, 15)).toEqual([1, 2, null, 7, 8, 9, null, 14, 15]);
  });
});
