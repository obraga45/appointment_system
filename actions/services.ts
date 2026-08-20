"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { fail, ok, zodErrorMessage, type ActionResult } from "@/lib/action-result";
import { serviceSchema } from "@/lib/validations";

export async function createService(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = serviceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const user = await requireUser();
    const service = await prisma.service.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        durationMinutes: parsed.data.durationMinutes,
        price: parsed.data.price,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return ok({ id: service.id });
  } catch (error) {
    console.error("[services] createService:", error);
    return fail("Não foi possível criar o serviço");
  }
}

export async function updateService(
  id: string,
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = serviceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    const user = await requireUser();
    const updated = await prisma.service.updateMany({
      where: { id, userId: user.id },
      data: {
        name: parsed.data.name,
        durationMinutes: parsed.data.durationMinutes,
        price: parsed.data.price,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive ?? true,
      },
    });

    if (updated.count === 0) {
      return fail("Serviço não encontrado");
    }

    return ok({ id });
  } catch (error) {
    return fail("Não foi possível atualizar o serviço");
  }
}

export async function toggleService(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const service = await prisma.service.findFirst({ where: { id, userId: user.id } });
    if (!service) {
      return fail("Serviço não encontrado");
    }

    await prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
    });

    return ok({ id });
  } catch {
    return fail("Não foi possível alterar o serviço");
  }
}

export async function deleteService(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const appointments = await prisma.appointment.count({
      where: { serviceId: id, userId: user.id },
    });

    if (appointments > 0) {
      await prisma.service.updateMany({
        where: { id, userId: user.id },
        data: { isActive: false },
      });
      return ok({ id });
    }

    const deleted = await prisma.service.deleteMany({ where: { id, userId: user.id } });
    if (deleted.count === 0) {
      return fail("Serviço não encontrado");
    }

    return ok({ id });
  } catch {
    return fail("Não foi possível eliminar o serviço");
  }
}
