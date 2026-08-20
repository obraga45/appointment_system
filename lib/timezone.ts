import { addDays, format, parse } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "Europe/Lisbon";

export const COMMON_TIMEZONES = [
  { value: "Europe/Lisbon", label: "Lisboa (continente)" },
  { value: "Atlantic/Madeira", label: "Madeira" },
  { value: "Atlantic/Azores", label: "Açores" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/London", label: "Londres" },
  { value: "UTC", label: "UTC" },
] as const;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function zonedDateTime(dateIso: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${dateIso}T${time}:00`, timeZone);
}

export function zonedDayStart(dateIso: string, timeZone: string): Date {
  return fromZonedTime(`${dateIso}T00:00:00`, timeZone);
}

export function zonedDayEnd(dateIso: string, timeZone: string): Date {
  return fromZonedTime(`${dateIso}T23:59:59.999`, timeZone);
}

export function calendarDateInZone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

export function startOfZonedDay(date: Date, timeZone: string): Date {
  return zonedDayStart(calendarDateInZone(date, timeZone), timeZone);
}

export function endOfZonedDay(date: Date, timeZone: string): Date {
  return zonedDayEnd(calendarDateInZone(date, timeZone), timeZone);
}

/** Weekday of a calendar date (0 = Sunday), independent of server timezone. */
export function calendarWeekday(dateIso: string): number {
  return parse(`${dateIso} 12:00`, "yyyy-MM-dd HH:mm", new Date()).getDay();
}

export function startOfZonedWeek(date: Date, timeZone: string): Date {
  const dateIso = calendarDateInZone(date, timeZone);
  const weekday = calendarWeekday(dateIso);
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  const base = parse(`${dateIso} 12:00`, "yyyy-MM-dd HH:mm", new Date());
  const monday = addDays(base, -mondayOffset);
  return zonedDayStart(format(monday, "yyyy-MM-dd"), timeZone);
}

export function formatInBusinessTz(date: Date, timeZone: string, pattern: string): string {
  return formatInTimeZone(date, timeZone, pattern);
}
