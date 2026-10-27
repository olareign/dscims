// Every date and time shown to people carries day, month, year, hour with AM or PM, and the zone
// (design review, 2026-10-27). Stored values are UTC; display is Africa/Lagos (WAT, UTC+1, no DST).
export const DISPLAY_TIME_ZONE = 'Africa/Lagos';

type DateInput = Date | string | number;

function parts(input: DateInput): Record<string, string> {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)) out[p.type] = p.value;
  return out;
}

export function formatDate(input: DateInput): string {
  const p = parts(input);
  return `${p.day} ${p.month} ${p.year}`;
}

export function formatTime(input: DateInput): string {
  const p = parts(input);
  return `${p.hour}:${p.minute} ${p.dayPeriod.toUpperCase()}`;
}

/** `27 Oct 2026, 9:12 AM` */
export function formatDateTime(input: DateInput): string {
  return `${formatDate(input)}, ${formatTime(input)}`;
}

/** `27 Oct 2026, 9:12 AM WAT` for places where the zone must be explicit. */
export function formatDateTimeZone(input: DateInput): string {
  return `${formatDateTime(input)} WAT`;
}
