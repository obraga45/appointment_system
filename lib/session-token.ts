import { sessionSecret } from "@/lib/env-secrets";

export const SESSION_COOKIE = "marcaja_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function hexFromBuffer(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return hexFromBuffer(signature);
}

export async function signSessionToken(userId: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SEC;
  const payload = `${userId}.${exp}`;
  const sig = await hmacSha256Hex(sessionSecret(), payload);
  return `${payload}.${sig}`;
}

export async function readSessionToken(
  token: string | undefined,
  nowMs = Date.now(),
): Promise<string | null> {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [userId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!userId || !sig || !Number.isFinite(exp) || exp * 1000 < nowMs) {
    return null;
  }

  const expected = await hmacSha256Hex(sessionSecret(), `${userId}.${expRaw}`);
  const givenBytes = hexToBytes(sig);
  const expectedBytes = hexToBytes(expected);
  if (!givenBytes || !expectedBytes || !bytesEqual(givenBytes, expectedBytes)) {
    return null;
  }

  return userId;
}
