import { AppointmentStatus } from "@prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { cancelScheduledReminders, notifyAppointmentCancelled } from "@/lib/reminders";
import { logSecurityEvent } from "@/lib/security-log";
import { normalizePhone } from "@/lib/utils";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function extractEvolutionInstance(payload: unknown): string {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const destination = asRecord(root.destination);
  const instanceObj = asRecord(root.instance);
  const raw = String(
    (typeof root.instance === "string" && root.instance) ||
      root.instanceName ||
      instanceObj.instanceName ||
      instanceObj.name ||
      data.instance ||
      data.instanceName ||
      destination.instance ||
      "",
  ).trim();
  return raw.slice(0, 80);
}

export async function cancelUpcomingByPhoneForBusiness(
  userId: string,
  phone: string,
): Promise<ActionResult<{ id: string }>> {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return fail("Número inválido");
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      userId,
      clientPhone: normalized,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: "asc" },
    select: { id: true },
  });

  if (!appointment) {
    return fail("Não encontrámos uma marcação futura neste número");
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: AppointmentStatus.CANCELLED },
  });
  await cancelScheduledReminders(appointment.id);
  await notifyAppointmentCancelled(appointment.id).catch(() => undefined);
  await logSecurityEvent({ action: "whatsapp_cancel", userId });
  return ok({ id: appointment.id });
}

export async function findBusinessByEvolutionInstance(instance: string) {
  if (!instance) {
    return null;
  }
  return prisma.user.findFirst({
    where: {
      OR: [{ evolutionInstance: instance }, { slug: instance }],
    },
    select: { id: true },
  });
}
