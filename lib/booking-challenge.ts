import { hmacSecret } from "@/lib/env-secrets";

const MIN_AGE_MS = 1_000;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function hexFromBuffer(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return hexFromBuffer(bytes.buffer);
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

function signaturesMatch(given: string, expected: string): boolean {
  if (given.length !== expected.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

export async function createBookingChallenge(nowMs = Date.now()): Promise<string> {
  const issuedAt = String(nowMs);
  const nonce = randomNonce();
  const payload = `${issuedAt}.${nonce}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifyBookingChallenge(
  value: string | undefined,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!value) {
    return false;
  }
  const parts = value.split(".");
  if (parts.length !== 3) {
    return false;
  }
  const [issuedAt, nonce, sig] = parts;
  if (!issuedAt || !nonce || !sig || !/^[0-9a-f]{32}$/i.test(nonce)) {
    return false;
  }
  const issued = Number(issuedAt);
  if (!Number.isFinite(issued)) {
    return false;
  }
  const age = nowMs - issued;
  if (age < MIN_AGE_MS || age > MAX_AGE_MS) {
    return false;
  }
  const expected = await sign(`${issuedAt}.${nonce}`);
  return signaturesMatch(sig, expected);
}
