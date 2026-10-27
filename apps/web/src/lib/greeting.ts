import { DISPLAY_TIME_ZONE } from "@dscims/shared";

export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIME_ZONE, hour: "numeric", hour12: false }).format(now)) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function longDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIME_ZONE, weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(now);
}

export function dayLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIME_ZONE, weekday: "short", day: "numeric" }).format(new Date(`${isoDate}T12:00:00+01:00`));
}

export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
