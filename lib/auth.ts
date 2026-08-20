import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isSupabaseConfigured } from "@/lib/config";
import { getSessionUserId } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) {
    const userId = await getSessionUserId();
    if (!userId) {
      return null;
    }
    return prisma.user.findUnique({ where: { id: userId } });
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
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Não autenticado");
  }
  return user;
}
