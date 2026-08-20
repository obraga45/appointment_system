import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function withBusinessLock<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      return fn(tx);
    },
    { timeout: 12_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
