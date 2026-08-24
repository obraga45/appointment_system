import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isProduction } from "@/lib/config";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  readSessionToken,
  signSessionToken,
} from "@/lib/session-token";

export { SESSION_COOKIE };

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

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}
