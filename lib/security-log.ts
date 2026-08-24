import { prisma } from "@/lib/prisma";

export async function logSecurityEvent(input: {
  action: string;
  userId?: string | null;
  ip?: string | null;
}) {
  try {
    await prisma.securityEvent.create({
      data: {
        action: input.action.slice(0, 80),
        userId: input.userId || null,
        ip: input.ip ? input.ip.slice(0, 80) : null,
      },
    });
  } catch (error) {
    console.error("[security] Falha a gravar evento:", error);
  }
}
