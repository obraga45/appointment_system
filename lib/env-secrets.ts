import { isProduction } from "@/lib/config";

function isWeakSecret(value: string) {
  return (
    !value ||
    value === "marcaja-dev-secret" ||
    value.includes("generate-a-long-random") ||
    value.startsWith("local-dev-") ||
    value === "same-as-CRON_SECRET"
  );
}

export function hmacSecret(): string {
  const session = (process.env.SESSION_SECRET ?? "").trim();
  if (!isWeakSecret(session)) {
    return session;
  }
  const cron = (process.env.CRON_SECRET ?? "").trim();
  if (!isWeakSecret(cron)) {
    return cron;
  }
  if (isProduction()) {
    throw new Error("SESSION_SECRET em falta em produção");
  }
  return "marcaja-dev-secret";
}

export function sessionSecret(): string {
  const value = (process.env.SESSION_SECRET ?? "").trim();
  if (isProduction() && isWeakSecret(value)) {
    throw new Error("SESSION_SECRET em falta ou inseguro em produção");
  }
  return value || "marcaja-dev-secret";
}

export function evolutionWebhookSecret(): string {
  const dedicated = (process.env.EVOLUTION_WEBHOOK_SECRET ?? "").trim();
  if (dedicated && dedicated !== "same-as-CRON_SECRET") {
    return dedicated;
  }
  return (process.env.CRON_SECRET ?? "").trim();
}
