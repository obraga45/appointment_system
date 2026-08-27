"use server";

import { after } from "next/server";
import { addDays, addMinutes, subHours } from "date-fns";
import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, ok, zodErrorMessage, type ActionResult } from "@/lib/action-result";
import {
  buildAvailabilityRange,
  generateDaySlots,
  generateTimeSlots,
  isDateFullyBlocked,
  rangeOverlapsBreak,
  rangeOverlapsException,
  type DayAvailability,
  type TimeSlot,
} from "@/lib/availability";
import { verifyBookingChallenge } from "@/lib/booking-challenge";
import { withBusinessLock } from "@/lib/lock";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  cancelScheduledReminders,
  hashToken,
  newCancelToken,
  notifyAppointmentCancelled,
  notifyBusinessOfBooking,
  scheduleAppointmentReminders,
  sendAppointmentConfirmation,
} from "@/lib/reminders";
import {
  calendarDateInZone,
  calendarWeekday,
  DEFAULT_TIMEZONE,
  zonedDateTime,
  zonedDayEnd,
  zonedDayStart,
} from "@/lib/timezone";
import { normalizePhone } from "@/lib/utils";
import {
  availabilityQuerySchema,
  availabilityRangeSchema,
  createAppointmentSchema,
  publicBookingSchema,
  updateAppointmentStatusSchema,
} from "@/lib/validations";

const PUBLIC_BOOKINGS_PER_PHONE = 8;

async function assertSlotIsFree(
  tx: { appointment: { findFirst: typeof prisma.appointment.findFirst } },
  input: {
    userId: string;
    startTime: Date;
    endTime: Date;
    excludeId?: string;
  },
) {
  const clash = await tx.appointment.findFirst({
    where: {
      userId: input.userId,
      id: input.excludeId ? { not: input.excludeId } : undefined,
      status: { not: AppointmentStatus.CANCELLED },
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime },
    },
    select: { id: true },
  });

  return !clash;
}

async function createAppointmentRecord(input: {
  userId: string;
  timeZone: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  notes?: string;
  date: string;
  time: string;
  enforcePhoneLimit?: boolean;
}) {
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, userId: input.userId, isActive: true },
    select: { id: true, durationMinutes: true },
  });

  if (!service) {
    return fail("Serviço não encontrado ou inativo");
  }

  const startTime = zonedDateTime(input.date, input.time, input.timeZone);
  if (startTime.getTime() < Date.now() - 60_000) {
    return fail("Não é possível marcar no passado");
  }

  const endTime = addMinutes(startTime, service.durationMinutes);
  const phone = normalizePhone(input.clientPhone);
  const cancelToken = newCancelToken();

  try {
    const appointment = await withBusinessLock(input.userId, async (tx) => {
      const weekday = calendarWeekday(input.date);
      const workingHour = await tx.workingHour.findUnique({
        where: { userId_dayOfWeek: { userId: input.userId, dayOfWeek: weekday } },
        select: { isClosed: true, breakStart: true, breakEnd: true },
      });
      if (!workingHour || workingHour.isClosed) {
        throw new Error("OUTSIDE_HOURS");
      }
      if (
        rangeOverlapsBreak(
          workingHour,
          input.date,
          input.timeZone,
          startTime.getTime(),
          endTime.getTime(),
        )
      ) {
        throw new Error("BREAK");
      }

      const exceptions = await tx.scheduleException.findMany({
        where: { userId: input.userId, date: input.date },
        select: { date: true, startTime: true, endTime: true },
      });
      if (
        rangeOverlapsException(
          exceptions,
          input.date,
          input.timeZone,
          startTime.getTime(),
          endTime.getTime(),
        )
      ) {
        throw new Error("BLOCKED");
      }

      const free = await assertSlotIsFree(tx, {
        userId: input.userId,
        startTime,
        endTime,
      });
      if (!free) {
        throw new Error("SLOT_TAKEN");
      }

      if (input.enforcePhoneLimit) {
        const recent = await tx.appointment.count({
          where: {
            userId: input.userId,
            clientPhone: phone,
            createdAt: { gte: subHours(new Date(), 24) },
            status: { not: AppointmentStatus.CANCELLED },
          },
        });
        if (recent >= PUBLIC_BOOKINGS_PER_PHONE) {
          throw new Error("PHONE_LIMIT");
        }
      }

      return tx.appointment.create({
        data: {
          userId: input.userId,
          serviceId: service.id,
          clientName: input.clientName,
          clientPhone: phone,
          clientEmail: input.clientEmail || null,
          startTime,
          endTime,
          status: AppointmentStatus.CONFIRMED,
          notes: input.notes || null,
          cancelTokenHash: hashToken(cancelToken),
        },
      });
    });

    after(async () => {
      await notifyBusinessOfBooking(appointment.id).catch((error) => {
        console.error("[appointments] Aviso ao negócio falhou:", error);
      });
      await sendAppointmentConfirmation(appointment.id, cancelToken).catch((error) => {
        console.error("[appointments] Confirmação falhou:", error);
      });
      await scheduleAppointmentReminders(appointment.id).catch((error) => {
        console.error("[appointments] Agendamento de lembretes falhou:", error);
      });
    });

    return ok({ id: appointment.id });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_TAKEN") {
      return fail("Esse horário já está ocupado");
    }
    if (error instanceof Error && error.message === "BREAK") {
      return fail("Esse horário coincide com a pausa do estabelecimento");
    }
    if (error instanceof Error && error.message === "BLOCKED") {
      return fail("O estabelecimento está encerrado nesse horário");
    }
    if (error instanceof Error && error.message === "OUTSIDE_HOURS") {
      return fail("O estabelecimento está encerrado nesse horário");
    }
    if (error instanceof Error && error.message === "PHONE_LIMIT") {
      return fail("Demasiadas marcações neste telemóvel. Tente mais tarde.");
    }
    console.error("[appointments] createAppointmentRecord:", error);
    return fail("Não foi possível criar a marcação");
  }
}

export async function createAppointment(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAppointmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const actor = await requireUser();
    const input = parsed.data;
    const userId = input.userId ?? actor.id;

    if (userId !== actor.id) {
      return fail("Não pode criar marcações para outro negócio");
    }

    return createAppointmentRecord({
      userId,
      timeZone: actor.timezone || DEFAULT_TIMEZONE,
      serviceId: input.serviceId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail,
      notes: input.notes,
      date: input.date,
      time: input.time,
    });
  } catch (error) {
    console.error("[appointments] createAppointment:", error);
    return fail(error instanceof Error ? error.message : "Não foi possível criar a marcação");
  }
}

export async function createPublicAppointment(
  businessSlug: string,
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = publicBookingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  if (parsed.data.companyWebsite) {
    return ok({ id: "ok" });
  }

  if (!(await verifyBookingChallenge(parsed.data.challenge))) {
    return fail("Sessão de marcação expirada. Atualize a página e tente novamente.");
  }

  const ip = await clientIp();
  const allowedIp = await rateLimit({
    name: "book",
    key: ip,
    limit: 8,
    windowSec: 10 * 60,
  });
  if (!allowedIp) {
    return fail("Demasiados pedidos. Aguarde uns minutos e tente novamente.");
  }

  try {
    const business = await prisma.user.findUnique({
      where: { slug: businessSlug },
    });

    if (!business) {
      return fail("Negócio não encontrado");
    }

    const input = parsed.data;
    return createAppointmentRecord({
      userId: business.id,
      timeZone: business.timezone || DEFAULT_TIMEZONE,
      serviceId: input.serviceId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail,
      notes: input.notes,
      date: input.date,
      time: input.time,
      enforcePhoneLimit: true,
    });
  } catch (error) {
    console.error("[appointments] createPublicAppointment:", error);
    return fail("Não foi possível concluir a marcação. Tente novamente.");
  }
}

export async function getAppointments(range?: {
  from?: Date;
  to?: Date;
}): Promise<ActionResult<Awaited<ReturnType<typeof prisma.appointment.findMany>>>> {
  try {
    const user = await requireUser();
    const tz = user.timezone || DEFAULT_TIMEZONE;
    const from = range?.from ?? zonedDayStart(calendarDateInZone(new Date(), tz), tz);
    const to = range?.to ?? zonedDayEnd(calendarDateInZone(new Date(), tz), tz);

    const appointments = await prisma.appointment.findMany({
      where: {
        userId: user.id,
        startTime: { gte: from, lte: to },
      },
      include: { service: true },
      orderBy: { startTime: "asc" },
    });

    return ok(appointments);
  } catch (error) {
    console.error("[appointments] getAppointments:", error);
    return fail(error instanceof Error ? error.message : "Erro ao carregar marcações");
  }
}

export async function getAppointmentById(id: string) {
  try {
    const user = await requireUser();
    const appointment = await prisma.appointment.findFirst({
      where: { id, userId: user.id },
      include: { service: true, notifications: true },
    });

    if (!appointment) {
      return fail("Marcação não encontrada");
    }

    return ok(appointment);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Erro ao carregar marcação");
  }
}

export async function updateAppointmentStatus(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateAppointmentStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const user = await requireUser();
    const current = await prisma.appointment.findFirst({
      where: { id: parsed.data.appointmentId, userId: user.id },
      select: { id: true, status: true },
    });

    if (!current) {
      return fail("Marcação não encontrada");
    }

    await prisma.appointment.update({
      where: { id: current.id },
      data: { status: parsed.data.status },
    });

    if (parsed.data.status === AppointmentStatus.CANCELLED) {
      await cancelScheduledReminders(current.id);
      await notifyAppointmentCancelled(current.id).catch((error) => {
        console.error("[appointments] Aviso de cancelamento falhou:", error);
      });
    }

    return ok({ id: parsed.data.appointmentId });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Não foi possível atualizar o estado");
  }
}

export async function cancelAppointmentByToken(
  token: string,
): Promise<ActionResult<{ businessName: string }>> {
  if (!token || token.length < 16) {
    return fail("Link de cancelamento inválido");
  }

  const ip = await clientIp();
  const allowed = await rateLimit({
    name: "cancel-token",
    key: ip,
    limit: 10,
    windowSec: 60 * 60,
  });
  if (!allowed) {
    return fail("Demasiados pedidos. Tente mais tarde.");
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { cancelTokenHash: hashToken(token) },
      include: { user: true, service: true },
    });

    if (!appointment) {
      return fail("Marcação não encontrada");
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      return ok({ businessName: appointment.user.businessName });
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      return fail("Esta marcação já foi concluída e não pode ser cancelada.");
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.CANCELLED },
    });
    await cancelScheduledReminders(appointment.id);
    await notifyAppointmentCancelled(appointment.id).catch((error) => {
      console.error("[appointments] Aviso de cancelamento público falhou:", error);
    });

    return ok({ businessName: appointment.user.businessName });
  } catch (error) {
    console.error("[appointments] cancelAppointmentByToken:", error);
    return fail("Não foi possível cancelar a marcação");
  }
}

export async function getPublicAppointmentByToken(token: string) {
  if (!token || token.length < 16) {
    return null;
  }

  return prisma.appointment.findUnique({
    where: { cancelTokenHash: hashToken(token) },
    select: {
      status: true,
      startTime: true,
      clientName: true,
      user: { select: { businessName: true, timezone: true } },
      service: { select: { name: true } },
    },
  });
}

async function loadSlotContext(userId: string, serviceId: string, date: string) {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timeZone = owner?.timezone || DEFAULT_TIMEZONE;
  const service = await prisma.service.findFirst({
    where: { id: serviceId, userId, isActive: true },
    select: { durationMinutes: true },
  });
  if (!service || !owner) {
    return null;
  }

  const weekday = calendarWeekday(date);
  const [workingHour, existing, exceptions] = await Promise.all([
    prisma.workingHour.findUnique({
      where: { userId_dayOfWeek: { userId, dayOfWeek: weekday } },
    }),
    prisma.appointment.findMany({
      where: {
        userId,
        status: { not: AppointmentStatus.CANCELLED },
        startTime: { gte: zonedDayStart(date, timeZone), lte: zonedDayEnd(date, timeZone) },
      },
      select: { startTime: true, endTime: true, status: true },
    }),
    prisma.scheduleException.findMany({
      where: { userId, date },
      select: { date: true, startTime: true, endTime: true },
    }),
  ]);

  return { service: { durationMinutes: service.durationMinutes }, timeZone, workingHour, existing, exceptions };
}

export async function getAvailableSlots(rawInput: unknown): Promise<ActionResult<string[]>> {
  const parsed = availabilityQuerySchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  const ip = await clientIp();
  const allowed = await rateLimit({
    name: "slots",
    key: ip,
    limit: 60,
    windowSec: 60,
  });
  if (!allowed) {
    return fail("Demasiados pedidos. Aguarde um momento.");
  }

  try {
    const ctx = await loadSlotContext(parsed.data.userId, parsed.data.serviceId, parsed.data.date);
    if (!ctx) {
      return fail("Serviço não encontrado");
    }

    return ok(
      generateTimeSlots({
        date: parsed.data.date,
        timeZone: ctx.timeZone,
        durationMinutes: ctx.service.durationMinutes,
        workingHour: ctx.workingHour,
        existing: ctx.existing,
        exceptions: ctx.exceptions,
      }),
    );
  } catch (error) {
    console.error("[appointments] getAvailableSlots:", error);
    return fail("Não foi possível obter horários disponíveis");
  }
}

export async function getDaySlots(
  rawInput: unknown,
): Promise<ActionResult<{ date: string; closed: boolean; slots: TimeSlot[] }>> {
  const parsed = availabilityQuerySchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  const ip = await clientIp();
  const allowed = await rateLimit({
    name: "day-slots",
    key: ip,
    limit: 60,
    windowSec: 60,
  });
  if (!allowed) {
    return fail("Demasiados pedidos. Aguarde um momento.");
  }

  try {
    const { date } = parsed.data;
    const ctx = await loadSlotContext(parsed.data.userId, parsed.data.serviceId, date);
    if (!ctx) {
      return fail("Serviço não encontrado");
    }

    const closed =
      !ctx.workingHour || ctx.workingHour.isClosed || isDateFullyBlocked(ctx.exceptions, date);
    const slots = generateDaySlots({
      date,
      timeZone: ctx.timeZone,
      durationMinutes: ctx.service.durationMinutes,
      workingHour: ctx.workingHour,
      existing: ctx.existing,
      exceptions: ctx.exceptions,
    });

    return ok({ date, closed, slots });
  } catch (error) {
    console.error("[appointments] getDaySlots:", error);
    return fail("Não foi possível obter os horários deste dia");
  }
}

export async function getAvailabilityOverview(
  rawInput: unknown,
): Promise<ActionResult<{ days: DayAvailability[] }>> {
  const parsed = availabilityRangeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  const ip = await clientIp();
  const allowed = await rateLimit({
    name: "overview",
    key: ip,
    limit: 40,
    windowSec: 60,
  });
  if (!allowed) {
    return fail("Demasiados pedidos. Aguarde um momento.");
  }

  try {
    const { userId, serviceId, days = 14 } = parsed.data;
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timeZone = owner?.timezone || DEFAULT_TIMEZONE;
    const service = await prisma.service.findFirst({
      where: { id: serviceId, userId, isActive: true },
      select: { durationMinutes: true },
    });

    if (!service || !owner) {
      return fail("Serviço não encontrado");
    }

    const from = zonedDayStart(calendarDateInZone(new Date(), timeZone), timeZone);
    const to = zonedDayEnd(
      calendarDateInZone(addDays(from, days - 1), timeZone),
      timeZone,
    );

    const fromKey = calendarDateInZone(from, timeZone);
    const toKey = calendarDateInZone(to, timeZone);

    const [workingHours, existing, exceptions] = await Promise.all([
      prisma.workingHour.findMany({ where: { userId } }),
      prisma.appointment.findMany({
        where: {
          userId,
          status: { not: AppointmentStatus.CANCELLED },
          startTime: { gte: from, lte: to },
        },
        select: { startTime: true, endTime: true, status: true },
      }),
      prisma.scheduleException.findMany({
        where: { userId, date: { gte: fromKey, lte: toKey } },
        select: { date: true, startTime: true, endTime: true },
      }),
    ]);

    return ok({
      days: buildAvailabilityRange({
        from,
        days,
        durationMinutes: service.durationMinutes,
        timeZone,
        workingHours,
        existing,
        exceptions,
      }),
    });
  } catch (error) {
    console.error("[appointments] getAvailabilityOverview:", error);
    return fail("Não foi possível carregar o calendário de disponibilidade");
  }
}
