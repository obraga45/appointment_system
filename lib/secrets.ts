import { createHash, timingSafeEqual } from "node:crypto";

export { evolutionWebhookSecret, sessionSecret } from "@/lib/env-secrets";

export function secretsEqual(given: string, expected: string): boolean {
  if (!expected) {
    return false;
  }
  const left = createHash("sha256").update(given).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}
