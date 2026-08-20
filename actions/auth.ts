"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fail, ok, zodErrorMessage, type ActionResult } from "@/lib/action-result";
import { DEFAULT_WORKING_HOURS } from "@/lib/availability";
import { appUrl, isSupabaseConfigured } from "@/lib/config";
import { sendPasswordResetLink } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/reminders";
import { clearSession, hashPassword, setSession, verifyPassword } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations";

async function uniqueSlug(businessName: string): Promise<string> {
  const base = slugify(businessName) || "negocio";
  let candidate = base;
  let suffix = 2;

  while (await prisma.user.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function registerUser(rawInput: unknown): Promise<ActionResult<{ slug: string }>> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  const { name, email, password, businessName, phone } = parsed.data;

  try {
    const slug = await uniqueSlug(businessName);

    if (!isSupabaseConfigured()) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return fail("Já existe uma conta com este email");
      }

      const user = await prisma.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          businessName,
          slug,
          passwordHash: hashPassword(password),
          workingHours: { create: DEFAULT_WORKING_HOURS },
        },
      });

      await setSession(user.id);
      return ok({ slug });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, businessName } },
    });

    if (error) {
      return fail(error.message);
    }

    if (!data.user) {
      return fail("Não foi possível criar a conta");
    }

    await prisma.user.create({
      data: {
        id: data.user.id,
        name,
        email,
        phone: phone || null,
        businessName,
        slug,
        workingHours: { create: DEFAULT_WORKING_HOURS },
      },
    });

    return ok({ slug });
  } catch (error) {
    console.error("[auth] registerUser:", error);
    return fail("Não foi possível criar a conta. Tente novamente.");
  }
}

export async function loginUser(rawInput: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    if (!isSupabaseConfigured()) {
      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });

      if (!user?.passwordHash || !verifyPassword(parsed.data.password, user.passwordHash)) {
        return fail("Email ou palavra-passe incorretos");
      }

      await setSession(user.id);
      return ok(undefined);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return fail("Email ou palavra-passe incorretos");
    }

    return ok(undefined);
  } catch (error) {
    console.error("[auth] loginUser:", error);
    return fail("Não foi possível iniciar sessão");
  }
}

export async function requestPasswordReset(rawInput: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  const ip = await clientIp();
  const allowed = await rateLimit({
    name: "forgot",
    key: `${ip}:${parsed.data.email}`,
    limit: 3,
    windowSec: 60 * 60,
  });
  if (!allowed) {
    return fail("Demasiados pedidos. Tente mais tarde.");
  }

  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${appUrl()}/reset-password`,
      });
      return ok(undefined);
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user?.passwordHash) {
      return ok(undefined);
    }

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await sendPasswordResetLink({
      email: user.email,
      name: user.name,
      phone: user.phone,
      url: `${appUrl()}/reset-password?token=${token}`,
    });

    return ok(undefined);
  } catch (error) {
    console.error("[auth] requestPasswordReset:", error);
    return fail("Não foi possível enviar o pedido. Tente novamente.");
  }
}

export async function resetPassword(rawInput: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(zodErrorMessage(parsed.error));
  }

  try {
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        return fail("Sessão expirada. Peça um novo link.");
      }
      return ok(undefined);
    }

    const tokenHash = hashToken(parsed.data.token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      return fail("Este link já não é válido. Peça um novo.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(parsed.data.password) },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    await setSession(record.userId);
    return ok(undefined);
  } catch (error) {
    console.error("[auth] resetPassword:", error);
    return fail("Não foi possível redefinir a palavra-passe");
  }
}

export async function logoutUser() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } else {
    await clearSession();
  }
  redirect("/login");
}
