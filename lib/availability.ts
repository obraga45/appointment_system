import { addDays, addMinutes, format, isBefore, parse } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { AppointmentStatus, type Appointment, type WorkingHour } from "@prisma/client";
import { calendarDateInZone, calendarWeekday, zonedDateTime } from "@/lib/timezone";

const SLOT_STEP_MINUTES = 15;

export type SlotState = "available" | "occupied" | "past";

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

export function generateDaySlots(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  workingHour: WorkingHour | null;
  existing: Pick<Appointment, "startTime" | "endTime" | "status">[];
  now?: Date;
}): TimeSlot[] {
  const { date, timeZone, durationMinutes, workingHour, existing, now = new Date() } = input;

  if (!workingHour || workingHour.isClosed) {
    return [];
  }

  const dayStart = zonedDateTime(date, workingHour.startTime, timeZone);
  const dayEnd = zonedDateTime(date, workingHour.endTime, timeZone);

  if (!isBefore(dayStart, dayEnd)) {
    return [];
  }

  const busy = existing.filter(
    (appointment) => appointment.status !== AppointmentStatus.CANCELLED,
  );

  const slots: TimeSlot[] = [];
  let cursor = dayStart;

  while (addMinutes(cursor, durationMinutes) <= dayEnd) {
    const slotEnd = addMinutes(cursor, durationMinutes);
    const occupied = busy.some(
      (appointment) => cursor < appointment.endTime && slotEnd > appointment.startTime,
    );
    const inThePast = isBefore(cursor, now);

    slots.push({
      time: formatInTimeZone(cursor, timeZone, "HH:mm"),
      state: occupied ? "occupied" : inThePast ? "past" : "available",
    });

    cursor = addMinutes(cursor, SLOT_STEP_MINUTES);
  }

  return slots;
}

export function generateTimeSlots(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  workingHour: WorkingHour | null;
  existing: Pick<Appointment, "startTime" | "endTime" | "status">[];
  now?: Date;
}): string[] {
  return generateDaySlots(input)
    .filter((slot) => slot.state === "available")
    .map((slot) => slot.time);
}

export function summarizeDay(slots: TimeSlot[], closed: boolean): DayStatus {
  if (closed || slots.length === 0) {
    return "closed";
  }
  return slots.some((slot) => slot.state === "available") ? "available" : "full";
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

  return Array.from({ length: input.days }, (_, index) => {
    const date = format(addDays(parse(`${startKey} 12:00`, "yyyy-MM-dd HH:mm", new Date()), index), "yyyy-MM-dd");
    const weekday = calendarWeekday(date);
    const workingHour = hoursByDay.get(weekday) ?? null;
    const closed = !workingHour || workingHour.isClosed;
    const dayExisting = input.existing.filter(
      (appointment) => calendarDateInZone(appointment.startTime, input.timeZone) === date,
    );
    const slots = generateDaySlots({
      date,
      timeZone: input.timeZone,
      durationMinutes: input.durationMinutes,
      workingHour,
      existing: dayExisting,
      now,
    });
    const availableCount = slots.filter((slot) => slot.state === "available").length;
    const occupiedCount = slots.filter((slot) => slot.state === "occupied").length;

    return {
      date,
      weekday,
      status: summarizeDay(slots, closed),
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
  isClosed: boolean;
}> = [
  { dayOfWeek: 0, startTime: "09:00", endTime: "13:00", isClosed: true },
  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 6, startTime: "09:00", endTime: "13:00", isClosed: false },
];
