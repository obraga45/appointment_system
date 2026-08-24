import { hmacSecret } from "@/lib/env-secrets";

const MIN_AGE_MS = 1_000;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function hexFromBuffer(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return hexFromBuffer(signature);
}

export async function createBookingChallenge(nowMs = Date.now()): Promise<string> {
  const issuedAt = String(nowMs);
  const sig = await sign(issuedAt);
  return `${issuedAt}.${sig}`;
}

export async function verifyBookingChallenge(
  value: string | undefined,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!value) {
    return false;
  }
  const dot = value.indexOf(".");
  if (dot < 1) {
    return false;
  }
  const issuedAt = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const issued = Number(issuedAt);
  if (!sig || !Number.isFinite(issued)) {
    return false;
  }
  const age = nowMs - issued;
  if (age < MIN_AGE_MS || age > MAX_AGE_MS) {
    return false;
  }
  const expected = await sign(issuedAt);
  if (expected.length !== sig.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
