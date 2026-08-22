"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, ok, zodErrorMessage, type ActionResult } from "@/lib/action-result";
import { slugify } from "@/lib/utils";
import { profileSchema, workingHoursSchema } from "@/lib/validations";

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
