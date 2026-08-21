import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isSupabaseConfigured } from "@/lib/config";
import { getSessionUserId } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  businessName: true,
  slug: true,
  timezone: true,
  evolutionInstance: true,
  createdAt: true,
} as const;

export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) {
    const userId = await getSessionUserId();
    if (!userId) {
      return null;
    }
    return prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: authUser.id },
    select: userSelect,
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Não autenticado");
  }
  return user;
}
