import { createHash, randomBytes } from "node:crypto";
import { addHours, subHours } from "date-fns";
import {
  AppointmentStatus,
  NotificationStatus,
  NotificationType,
} from "@prisma/client";
import { Client } from "@upstash/qstash";
import { prisma } from "@/lib/prisma";
import { appUrl, isQstashConfigured, publicCancelUrl } from "@/lib/config";
import {
  buildBusinessAlertMessage,
  buildBusinessCancelMessage,
  buildCancelConfirmationMessage,
  buildConfirmationMessage,
  buildDepositExpiredMessage,
  buildDepositRequestMessage,
  buildReminderMessage,
  businessAlertSenderInstance,
  sendBusinessAlert,
  sendOutboundMessage,
} from "@/lib/notifications";
import { getEvolutionOwnerNumber } from "@/lib/evolution";
import { DEPOSIT_HOLD_MINUTES } from "@/lib/deposit";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { normalizePhone } from "@/lib/utils";

export function newCancelToken() {
  return randomBytes(24).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function cancelUrl(token: string) {
  return publicCancelUrl(token);
}

function qstash() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    return null;
  }
  return new Client({ token });
}

async function logNotification(
  appointmentId: string,
  type: NotificationType,
  result: { ok: boolean; error?: string },
) {
  await prisma.notificationLog.upsert({
    where: { appointmentId_type: { appointmentId, type } },
    create: {
      appointmentId,
      type,
      status: result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
      errorMessage: result.error,
    },
    update: {
      status: result.ok ? NotificationStatus.SENT : NotificationStatus.FAILED,
      errorMessage: result.error,
      sentAt: new Date(),
    },
  });
}

async function alreadySent(appointmentId: string, type: NotificationType) {
  const existing = await prisma.notificationLog.findUnique({
    where: { appointmentId_type: { appointmentId, type } },
  });
  return existing?.status === NotificationStatus.SENT;
}

export async function sendAppointmentConfirmation(
  appointmentId: string,
  cancelToken?: string,
) {
  if (await alreadySent(appointmentId, NotificationType.CONFIRMATION)) {
    return { skipped: true as const };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });

  if (!appointment) {
    return { skipped: true as const };
  }

  const message = buildConfirmationMessage({
    businessName: appointment.user.businessName,
    clientName: appointment.clientName,
    serviceName: appointment.service.name,
    startTime: appointment.startTime,
    timeZone: appointment.user.timezone || DEFAULT_TIMEZONE,
    cancelUrl: cancelToken ? cancelUrl(cancelToken) : undefined,
  });

  const result = await sendOutboundMessage(
    appointment.clientPhone,
    message,
    appointment.user.evolutionInstance,
  );
  await logNotification(appointmentId, NotificationType.CONFIRMATION, result);
  return { skipped: false as const, ok: result.ok, error: result.error };
}

export async function sendDepositRequest(appointmentId: string, cancelToken?: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });
  if (!appointment || !appointment.depositRequired || appointment.depositAmount == null) {
    return { skipped: true as const };
  }

  const message = buildDepositRequestMessage({
    businessName: appointment.user.businessName,
    clientName: appointment.clientName,
    serviceName: appointment.service.name,
    startTime: appointment.startTime,
    amount: Number(appointment.depositAmount.toString()),
    holdMinutes: DEPOSIT_HOLD_MINUTES,
    mbWay: appointment.user.depositMbWay,
    iban: appointment.user.depositIban,
    timeZone: appointment.user.timezone || DEFAULT_TIMEZONE,
    cancelUrl: cancelToken ? cancelUrl(cancelToken) : undefined,
  });

  const result = await sendOutboundMessage(
    appointment.clientPhone,
    message,
    appointment.user.evolutionInstance,
  );
  return { skipped: false as const, ok: result.ok, error: result.error };
}

export async function notifyBusinessOfBooking(appointmentId: string) {
  if (await alreadySent(appointmentId, NotificationType.BUSINESS_ALERT)) {
    return { skipped: true as const };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });
  if (!appointment) {
    return { skipped: true as const };
  }

  const delivered = await sendBusinessWhatsApp(
    appointment.user,
    buildBusinessAlertMessage({
      businessName: appointment.user.businessName,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      serviceName: appointment.service.name,
      startTime: appointment.startTime,
      timeZone: appointment.user.timezone || DEFAULT_TIMEZONE,
      depositAmount: appointment.depositRequired
        ? Number(appointment.depositAmount?.toString() ?? 0)
        : null,
      depositHoldMinutes: appointment.depositRequired ? DEPOSIT_HOLD_MINUTES : undefined,
    }),
    appointment.clientPhone,
  );

  if (delivered.skipped) {
    return { skipped: true as const };
  }

  await logNotification(appointmentId, NotificationType.BUSINESS_ALERT, delivered);
  return { skipped: false as const, ok: delivered.ok, error: delivered.error };
}

function samePhone(a: string, b: string) {
  return normalizePhone(a) === normalizePhone(b);
}

async function sendBusinessWhatsApp(
  user: { phone: string | null; evolutionInstance: string | null },
  message: string,
  clientPhone?: string,
) {
  const connectedPhone = user.evolutionInstance
    ? await getEvolutionOwnerNumber(user.evolutionInstance)
    : null;
  const dest = user.phone || connectedPhone;
  if (!dest) {
    console.warn("[reminders] Negócio sem telemóvel para avisos de marcação");
    return { ok: false, skipped: true as const, error: "Sem telemóvel para avisos" };
  }

  if (clientPhone && samePhone(dest, clientPhone)) {
    console.warn("[reminders] Aviso ao negócio omitido: telemóvel igual ao do cliente");
    return { ok: false, skipped: true as const, error: "Telemóvel igual ao do cliente" };
  }

  const instance = businessAlertSenderInstance({
    destinationPhone: dest,
    businessInstance: user.evolutionInstance,
    connectedPhone,
  });
  if (!instance) {
    console.warn(
      "[reminders] Não dá para avisar o próprio WhatsApp ligado ao QR. Liga a instância da TemVagas ou um telemóvel diferente.",
    );
    return { ok: false, skipped: true as const, error: "Sem instância para avisar o espaço" };
  }

  const result = await sendBusinessAlert(dest, message, instance);
  return { ...result, skipped: false as const };
}

export async function sendAppointmentReminder(
  appointmentId: string,
  type: typeof NotificationType.REMINDER_24H | typeof NotificationType.REMINDER_2H,
) {
  if (await alreadySent(appointmentId, type)) {
    return { skipped: true as const };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });

  if (
    !appointment ||
    appointment.status !== AppointmentStatus.CONFIRMED
  ) {
    return { skipped: true as const };
  }

  const hoursAhead = type === NotificationType.REMINDER_24H ? 24 : 2;
  const message = buildReminderMessage({
    businessName: appointment.user.businessName,
    clientName: appointment.clientName,
    serviceName: appointment.service.name,
    startTime: appointment.startTime,
    hoursAhead,
    timeZone: appointment.user.timezone || DEFAULT_TIMEZONE,
    cancelUrl: undefined,
  });

  const result = await sendOutboundMessage(
    appointment.clientPhone,
    message,
    appointment.user.evolutionInstance,
  );
  await logNotification(appointmentId, type, result);
  return { skipped: false as const, ok: result.ok, error: result.error };
}

export async function notifyDepositExpired(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });
  if (!appointment) {
    return;
  }

  const instance = appointment.user.evolutionInstance;
  await sendOutboundMessage(
    appointment.clientPhone,
    buildDepositExpiredMessage({
      businessName: appointment.user.businessName,
      clientName: appointment.clientName,
    }),
    instance,
  );

  await sendBusinessWhatsApp(
    appointment.user,
    [
      `Marcação sem sinal libertada em ${appointment.user.businessName}`,
      `Cliente: ${appointment.clientName}`,
      `Serviço: ${appointment.service.name}`,
    ].join("\n"),
    appointment.clientPhone,
  );
}

export async function notifyAppointmentCancelled(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { user: true, service: true },
  });
  if (!appointment) {
    return;
  }

  const instance = appointment.user.evolutionInstance;
  const clientMessage = buildCancelConfirmationMessage({
    businessName: appointment.user.businessName,
    clientName: appointment.clientName,
  });
  await sendOutboundMessage(appointment.clientPhone, clientMessage, instance);

  await sendBusinessWhatsApp(
    appointment.user,
    buildBusinessCancelMessage({
      businessName: appointment.user.businessName,
      clientName: appointment.clientName,
      serviceName: appointment.service.name,
      startTime: appointment.startTime,
      timeZone: appointment.user.timezone || DEFAULT_TIMEZONE,
    }),
    appointment.clientPhone,
  );
}

async function publishReminder(
  client: Client,
  appointmentId: string,
  type: "REMINDER_24H" | "REMINDER_2H",
  notBeforeMs: number,
) {
  const response = await client.publishJSON({
    url: `${appUrl()}/api/qstash/reminders`,
    body: { appointmentId, type },
    notBefore: Math.floor(notBeforeMs / 1000),
  });
  return response.messageId;
}

export async function scheduleAppointmentReminders(appointmentId: string) {
  if (!isQstashConfigured()) {
    return;
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, startTime: true, reminder24hJobId: true, reminder2hJobId: true },
  });
  if (!appointment) {
    return;
  }

  const client = qstash();
  if (!client) {
    return;
  }

  const now = Date.now();
  const data: { reminder24hJobId?: string; reminder2hJobId?: string } = {};
  const t24 = appointment.startTime.getTime() - 24 * 60 * 60 * 1000;
  const t2 = appointment.startTime.getTime() - 2 * 60 * 60 * 1000;

  try {
    if (!appointment.reminder24hJobId && t24 > now + 60_000) {
      data.reminder24hJobId = await publishReminder(client, appointment.id, "REMINDER_24H", t24);
    }
    if (!appointment.reminder2hJobId && t2 > now + 60_000) {
      data.reminder2hJobId = await publishReminder(client, appointment.id, "REMINDER_2H", t2);
    }
    if (Object.keys(data).length > 0) {
      await prisma.appointment.update({ where: { id: appointment.id }, data });
    }
  } catch (error) {
    console.error("[reminders] Falha a agendar QStash:", error);
  }
}

export async function cancelScheduledReminders(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { reminder24hJobId: true, reminder2hJobId: true },
  });
  if (!appointment) {
    return;
  }

  const client = qstash();
  if (!client) {
    return;
  }

  for (const jobId of [appointment.reminder24hJobId, appointment.reminder2hJobId]) {
    if (!jobId) continue;
    try {
      await client.messages.delete(jobId);
    } catch (error) {
      console.warn("[reminders] Não foi possível apagar job QStash:", jobId, error);
    }
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { reminder24hJobId: null, reminder2hJobId: null },
  });
}

const SAFETY_WINDOW_MINUTES = 45;

function reminderRange(hoursAhead: 24 | 2): { from: Date; until: Date } {
  const now = new Date();

  if (hoursAhead === 24) {
    return {
      from: addHours(now, 8),
      until: addHours(now, 36),
    };
  }

  const center = addHours(now, 2);
  return {
    from: new Date(center.getTime() - SAFETY_WINDOW_MINUTES * 60_000),
    until: new Date(center.getTime() + SAFETY_WINDOW_MINUTES * 60_000),
  };
}

export async function processReminderWindow(hoursAhead: 24 | 2) {
  const type =
    hoursAhead === 24 ? NotificationType.REMINDER_24H : NotificationType.REMINDER_2H;
  const { from, until } = reminderRange(hoursAhead);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: AppointmentStatus.CONFIRMED,
      startTime: { gte: from, lte: until },
      notifications: { none: { type, status: NotificationStatus.SENT } },
    },
    select: { id: true },
  });

  const results = [];
  for (const appointment of appointments) {
    results.push(await sendAppointmentReminder(appointment.id, type));
  }

  return {
    hoursAhead,
    candidates: appointments.length,
    sent: results.filter((item) => !item.skipped && item.ok).length,
    failed: results.filter((item) => !item.skipped && item.ok === false).length,
    skipped: results.filter((item) => item.skipped).length,
  };
}

export async function retryFailedReminders() {
  const from = subHours(new Date(), 26);
  const failed = await prisma.notificationLog.findMany({
    where: {
      status: NotificationStatus.FAILED,
      type: { in: [NotificationType.REMINDER_24H, NotificationType.REMINDER_2H] },
      sentAt: { gte: from },
      appointment: {
        status: AppointmentStatus.CONFIRMED,
        startTime: { gte: new Date() },
      },
    },
    select: { appointmentId: true, type: true },
  });

  let sent = 0;
  let failedCount = 0;
  for (const item of failed) {
    if (item.type === NotificationType.CONFIRMATION) continue;
    const result = await sendAppointmentReminder(
      item.appointmentId,
      item.type as typeof NotificationType.REMINDER_24H | typeof NotificationType.REMINDER_2H,
    );
    if (!result.skipped && result.ok) sent += 1;
    if (!result.skipped && result.ok === false) failedCount += 1;
  }

  return { candidates: failed.length, sent, failed: failedCount };
}
