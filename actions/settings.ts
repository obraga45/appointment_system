"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, ok, zodErrorMessage, type ActionResult } from "@/lib/action-result";
import { isSupabaseConfigured } from "@/lib/config";
import { evolutionInstanceName, logoutEvolutionInstance } from "@/lib/evolution";
import { clientIp } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";
import { clearSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { calendarDateInZone, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { normalizeIban } from "@/lib/deposit";
import { normalizePhone, slugify } from "@/lib/utils";
import {
  depositSettingsSchema,
  profileSchema,
  scheduleExceptionSchema,
  workingHoursSchema,
} from "@/lib/validations";

export async function updateProfile(rawInput: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const user = await requireUser();
    const nextSlug = slugify(parsed.data.businessName) || user.slug;

    const clash = await prisma.user.findFirst({
      where: { slug: nextSlug, id: { not: user.id } },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        businessName: parsed.data.businessName,
        phone: parsed.data.phone || null,
        timezone: parsed.data.timezone,
        slug: clash ? user.slug : nextSlug,
      },
    });

    return ok(undefined);
  } catch (error) {
    console.error("[settings] updateProfile:", error);
    return fail("Não foi possível guardar o perfil");
  }
}

export async function updateDepositSettings(rawInput: unknown): Promise<ActionResult> {
  const parsed = depositSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const user = await requireUser();
    const mbWay = parsed.data.mbWay?.trim() ? normalizePhone(parsed.data.mbWay) : null;
    const iban = parsed.data.iban?.trim() ? normalizeIban(parsed.data.iban) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        depositEnabled: parsed.data.enabled,
        depositAmount: parsed.data.enabled ? parsed.data.amount : parsed.data.amount || null,
        depositMbWay: mbWay,
        depositIban: iban,
      },
    });

    return ok(undefined);
  } catch (error) {
    console.error("[settings] updateDepositSettings:", error);
    return fail("Não foi possível guardar o sinal");
  }
}

export async function updateWorkingHours(rawInput: unknown): Promise<ActionResult> {
  const parsed = workingHoursSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const user = await requireUser();

    await prisma.$transaction(
      parsed.data.hours.map((hour) =>
        prisma.workingHour.upsert({
          where: { userId_dayOfWeek: { userId: user.id, dayOfWeek: hour.dayOfWeek } },
          create: { userId: user.id, ...hour },
          update: {
            startTime: hour.startTime,
            endTime: hour.endTime,
            breakStart: hour.breakStart ?? null,
            breakEnd: hour.breakEnd ?? null,
            isClosed: hour.isClosed,
          },
        }),
      ),
    );

    return ok(undefined);
  } catch (error) {
    console.error("[settings] updateWorkingHours:", error);
    return fail("Não foi possível guardar os horários");
  }
}

export async function createScheduleException(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = scheduleExceptionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const user = await requireUser();
    const today = calendarDateInZone(new Date(), user.timezone || DEFAULT_TIMEZONE);
    if (parsed.data.date < today) {
      return fail("Não é possível encerrar uma data que já passou");
    }

    const created = await prisma.scheduleException.create({
      data: {
        userId: user.id,
        date: parsed.data.date,
        startTime: parsed.data.startTime ?? null,
        endTime: parsed.data.endTime ?? null,
        note: parsed.data.note?.trim() || null,
      },
      select: { id: true },
    });

    return ok(created);
  } catch (error) {
    console.error("[settings] createScheduleException:", error);
    return fail("Não foi possível encerrar esse horário");
  }
}

export async function deleteScheduleException(id: string): Promise<ActionResult> {
  if (!id) {
    return fail("Encerramento inválido");
  }

  try {
    const user = await requireUser();
    const existing = await prisma.scheduleException.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return fail("Encerramento não encontrado");
    }

    await prisma.scheduleException.delete({ where: { id } });
    return ok(undefined);
  } catch (error) {
    console.error("[settings] deleteScheduleException:", error);
    return fail("Não foi possível reabrir esse horário");
  }
}

export async function deleteAccount(confirmation: string): Promise<never | ActionResult> {
  const name = confirmation.trim();
  if (name.length < 2) {
    return fail("Escreva o nome do negócio para confirmar");
  }

  try {
    const user = await requireUser();
    if (name !== user.businessName) {
      return fail("O nome do negócio não coincide");
    }

    const ip = await clientIp();
    await logSecurityEvent({ action: "account_delete", userId: user.id, ip });
    await logoutEvolutionInstance(evolutionInstanceName(user.evolutionInstance || user.slug)).catch(
      () => undefined,
    );
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    console.error("[settings] deleteAccount:", error);
    return fail("Não foi possível eliminar a conta");
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } else {
    await clearSession();
  }
  redirect("/login");
}
