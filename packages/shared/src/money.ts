// Money is integer kobo (NGN), never a float (PRD section 7).
export type Kobo = number;

export function nairaToKobo(naira: string | number): Kobo {
  const text = typeof naira === 'number' ? naira.toFixed(2) : naira.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new RangeError(`Invalid naira amount: ${String(naira)}`);
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const kobo = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(kobo)) throw new RangeError('Amount is too large');
  return negative ? -kobo : kobo;
}

export function formatNaira(kobo: Kobo): string {
  if (!Number.isInteger(kobo)) throw new RangeError('Kobo must be an integer');
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(kobo);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₦${whole}.${String(abs % 100).padStart(2, '0')}`;
}
