import { addDays, format, parse } from "date-fns";
import { AppointmentStatus, type Appointment, type WorkingHour } from "@prisma/client";
import { calendarDateInZone, calendarWeekday, zonedDateTime } from "@/lib/timezone";

const SLOT_STEP_MINUTES = 15;

export type SlotState = "available" | "occupied" | "break" | "past";

export type TimeSlot = {
  time: string;
  state: SlotState;
};

export type DayStatus = "available" | "full" | "closed";

export type DayAvailability = {
  date: string;
  weekday: number;
  status: DayStatus;
  availableCount: number;
  occupiedCount: number;
};

function parseMinutes(time: string): number {
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(3, 5));
  return hours * 60 + minutes;
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours < 10 ? "0" : ""}${hours}:${minutes < 10 ? "0" : ""}${minutes}`;
}

function breakRange(
  workingHour: Pick<WorkingHour, "breakStart" | "breakEnd">,
  date: string,
  timeZone: string,
): [number, number] | null {
  if (!workingHour.breakStart || !workingHour.breakEnd) {
    return null;
  }
  const start = zonedDateTime(date, workingHour.breakStart, timeZone).getTime();
  const end = zonedDateTime(date, workingHour.breakEnd, timeZone).getTime();
  if (start >= end) {
    return null;
  }
  return [start, end];
}

export function rangeOverlapsBreak(
  workingHour: Pick<WorkingHour, "breakStart" | "breakEnd"> | null,
  date: string,
  timeZone: string,
  startMs: number,
  endMs: number,
): boolean {
  if (!workingHour) {
    return false;
  }
  const pause = breakRange(workingHour, date, timeZone);
  if (!pause) {
    return false;
  }
  return startMs < pause[1] && endMs > pause[0];
}

function busyRanges(existing: Pick<Appointment, "startTime" | "endTime" | "status">[]) {
  const ranges: Array<[number, number]> = [];
  for (const appointment of existing) {
    if (appointment.status === AppointmentStatus.CANCELLED) {
      continue;
    }
    ranges.push([appointment.startTime.getTime(), appointment.endTime.getTime()]);
  }
  return ranges;
}

function walkDaySlots<T>(
  input: {
    date: string;
    timeZone: string;
    durationMinutes: number;
    workingHour: WorkingHour | null;
    existing: Pick<Appointment, "startTime" | "endTime" | "status">[];
    now?: Date;
  },
  onSlot: (slot: {
    time: string;
    startMs: number;
    endMs: number;
    occupied: boolean;
    onBreak: boolean;
    past: boolean;
  }) => T | void,
): T[] {
  const { date, timeZone, durationMinutes, workingHour, existing, now = new Date() } = input;
  const collected: T[] = [];

  if (!workingHour || workingHour.isClosed) {
    return collected;
  }

  const dayStart = zonedDateTime(date, workingHour.startTime, timeZone);
  const dayEnd = zonedDateTime(date, workingHour.endTime, timeZone);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();
  if (dayStartMs >= dayEndMs) {
    return collected;
  }

  const durationMs = durationMinutes * 60_000;
  const stepMs = SLOT_STEP_MINUTES * 60_000;
  const nowMs = now.getTime();
  const busy = busyRanges(existing);
  const pause = breakRange(workingHour, date, timeZone);
  let cursorMs = dayStartMs;
  let minutes = parseMinutes(workingHour.startTime);

  while (cursorMs + durationMs <= dayEndMs) {
    const endMs = cursorMs + durationMs;
    const occupied = busy.some(([start, end]) => cursorMs < end && endMs > start);
    const onBreak = Boolean(pause && cursorMs < pause[1] && endMs > pause[0]);
    const past = cursorMs < nowMs;
    const result = onSlot({
      time: formatMinutes(minutes),
      startMs: cursorMs,
      endMs,
      occupied,
      onBreak,
      past,
    });
    if (result !== undefined) {
      collected.push(result);
    }
    cursorMs += stepMs;
    minutes += SLOT_STEP_MINUTES;
  }

  return collected;
}

export function generateDaySlots(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  workingHour: WorkingHour | null;
  existing: Pick<Appointment, "startTime" | "endTime" | "status">[];
  now?: Date;
}): TimeSlot[] {
  return walkDaySlots(input, (slot) => ({
    time: slot.time,
    state: (slot.onBreak
      ? "break"
      : slot.occupied
        ? "occupied"
        : slot.past
          ? "past"
          : "available") as SlotState,
  }));
}

export function generateTimeSlots(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  workingHour: WorkingHour | null;
  existing: Pick<Appointment, "startTime" | "endTime" | "status">[];
  now?: Date;
}): string[] {
  const times: string[] = [];
  walkDaySlots(input, (slot) => {
    if (!slot.occupied && !slot.onBreak && !slot.past) {
      times.push(slot.time);
    }
  });
  return times;
}

function summarizeDayFromCounts(available: number, occupied: number, closed: boolean): DayStatus {
  if (closed) {
    return "closed";
  }
  if (available > 0) {
    return "available";
  }
  return occupied > 0 ? "full" : "closed";
}

export function buildAvailabilityRange(input: {
  from: Date;
  days: number;
  durationMinutes: number;
  timeZone: string;
  workingHours: WorkingHour[];
  existing: Pick<Appointment, "startTime" | "endTime" | "status">[];
  now?: Date;
}): DayAvailability[] {
  const now = input.now ?? new Date();
  const hoursByDay = new Map(input.workingHours.map((hour) => [hour.dayOfWeek, hour]));
  const startKey = calendarDateInZone(input.from, input.timeZone);
  const existingByDate = new Map<string, Pick<Appointment, "startTime" | "endTime" | "status">[]>();

  for (const appointment of input.existing) {
    const key = calendarDateInZone(appointment.startTime, input.timeZone);
    const list = existingByDate.get(key);
    if (list) {
      list.push(appointment);
    } else {
      existingByDate.set(key, [appointment]);
    }
  }

  const startNoon = parse(`${startKey} 12:00`, "yyyy-MM-dd HH:mm", new Date());

  return Array.from({ length: input.days }, (_, index) => {
    const date = format(addDays(startNoon, index), "yyyy-MM-dd");
    const weekday = calendarWeekday(date);
    const workingHour = hoursByDay.get(weekday) ?? null;
    const closed = !workingHour || workingHour.isClosed;
    let availableCount = 0;
    let occupiedCount = 0;

    if (!closed) {
      walkDaySlots(
        {
          date,
          timeZone: input.timeZone,
          durationMinutes: input.durationMinutes,
          workingHour,
          existing: existingByDate.get(date) ?? [],
          now,
        },
        (slot) => {
          if (slot.occupied || slot.onBreak) {
            occupiedCount += 1;
          } else if (!slot.past) {
            availableCount += 1;
          }
        },
      );
    }

    return {
      date,
      weekday,
      status: summarizeDayFromCounts(availableCount, occupiedCount, closed),
      availableCount,
      occupiedCount,
    };
  });
}

/** Naive local parse for UI display of a chosen calendar slot. */
export function combineDateAndTime(dateIso: string, time: string): Date {
  return parse(`${dateIso} ${time}`, "yyyy-MM-dd HH:mm", new Date());
}

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export const DEFAULT_WORKING_HOURS: Array<{
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  isClosed: boolean;
}> = [
  { dayOfWeek: 0, startTime: "09:00", endTime: "13:00", breakStart: null, breakEnd: null, isClosed: true },
  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", breakStart: null, breakEnd: null, isClosed: false },
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", breakStart: null, breakEnd: null, isClosed: false },
  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", breakStart: null, breakEnd: null, isClosed: false },
  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", breakStart: null, breakEnd: null, isClosed: false },
  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", breakStart: null, breakEnd: null, isClosed: false },
  { dayOfWeek: 6, startTime: "09:00", endTime: "13:00", breakStart: null, breakEnd: null, isClosed: false },
];
