import { BRAND } from "@/lib/brand";

export function readEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.startsWith("https://") &&
    !url.includes("YOUR_PROJECT") &&
    Boolean(key) &&
    key !== "your-anon-key"
  );
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function canonicalSiteUrl() {
  return `https://${BRAND.domain}`;
}

function isLocalUrl(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isEphemeralHost(url: string) {
  return /\.vercel\.app($|[:/])/i.test(url);
}

export function appUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");

  if (fromEnv && isLocalUrl(fromEnv)) {
    return fromEnv;
  }

  if (!isProduction()) {
    return fromEnv && !isEphemeralHost(fromEnv) ? fromEnv : "http://localhost:3000";
  }

  if (fromEnv && !isEphemeralHost(fromEnv) && /^https:\/\//i.test(fromEnv)) {
    return fromEnv;
  }

  return canonicalSiteUrl();
}

export function publicBookingUrl(slug: string) {
  return `${appUrl()}/agendar/${slug}`;
}

export function publicCancelUrl(token: string) {
  return `${appUrl()}/agendar/cancel/${token}`;
}

export function isQstashConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}

export function isQstashVerifyConfigured(): boolean {
  return Boolean(
    process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY,
  );
}

export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY ?? "";
  return key.length > 0 && !key.startsWith("your-");
}

export function isEvolutionConfigured(): boolean {
  return Boolean(readEnv("EVOLUTION_API_URL") && readEnv("EVOLUTION_API_KEY"));
}

export function isTwilioSmsConfigured(): boolean {
  return Boolean(
    readEnv("TWILIO_ACCOUNT_SID") &&
      readEnv("TWILIO_AUTH_TOKEN") &&
      (readEnv("TWILIO_SMS_FROM") || readEnv("TWILIO_FROM_NUMBER")),
  );
}
