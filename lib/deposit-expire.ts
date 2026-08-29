import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function expireUnpaidDeposits(filter?: { userId?: string }): Promise<string[]> {
  const expired = await prisma.appointment.findMany({
    where: {
      status: AppointmentStatus.PENDING,
      depositRequired: true,
      depositExpiresAt: { lte: new Date() },
      ...(filter?.userId ? { userId: filter.userId } : {}),
    },
    select: { id: true },
  });

  const cancelled: string[] = [];
  for (const row of expired) {
    const result = await prisma.appointment.updateMany({
      where: { id: row.id, status: AppointmentStatus.PENDING },
      data: { status: AppointmentStatus.CANCELLED },
    });
    if (result.count === 1) {
      cancelled.push(row.id);
    }
  }
  return cancelled;
}
