import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isProduction } from "@/lib/config";

export const SESSION_COOKIE = "marcaja_session";

function secret() {
  const value = process.env.SESSION_SECRET || process.env.CRON_SECRET;
  if (isProduction()) {
    if (
      !value ||
      value === "marcaja-dev-secret" ||
      value.includes("generate-a-long-random") ||
      value.startsWith("local-dev-")
    ) {
      throw new Error("SESSION_SECRET (ou CRON_SECRET) em falta ou inseguro em produção");
    }
  }
  return value || "marcaja-dev-secret";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const next = scryptSync(password, salt, 64);
  const previous = Buffer.from(hash, "hex");
  if (previous.length !== next.length) {
    return false;
  }

  return timingSafeEqual(previous, next);
}

export function signUserId(userId: string): string {
  const sig = createHmac("sha256", secret()).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

export function readSignedUserId(token: string | undefined): string | null {
  if (!token) {
    return null;
  }

  const [userId, sig] = token.split(".");
  if (!userId || !sig) {
    return null;
  }

  const expected = createHmac("sha256", secret()).update(userId).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  return userId;
}

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signUserId(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return readSignedUserId(store.get(SESSION_COOKIE)?.value);
}
