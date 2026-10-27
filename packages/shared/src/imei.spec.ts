import { describe, expect, it } from 'vitest';
import { isValidImei } from './imei.js';

describe('isValidImei', () => {
  it('accepts a 15-digit number that passes Luhn', () => {
    expect(isValidImei('490154203237518')).toBe(true);
  });
  it('rejects a Luhn failure', () => {
    expect(isValidImei('490154203237519')).toBe(false);
  });
  it.each(['', '49015420323751', '4901542032375180', '49015420323751a', ' 490154203237518'])('rejects malformed input %j', (v) => {
    expect(isValidImei(v)).toBe(false);
  });
});
