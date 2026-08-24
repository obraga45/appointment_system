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

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
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
