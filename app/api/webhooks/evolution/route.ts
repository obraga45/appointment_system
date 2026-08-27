import { NextRequest, NextResponse } from "next/server";
import { cancelUpcomingByPhoneForBusiness, extractEvolutionInstance, findBusinessByEvolutionInstance } from "@/lib/whatsapp-cancel";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { evolutionWebhookSecret, secretsEqual } from "@/lib/secrets";
import { normalizePhone } from "@/lib/utils";

function isAuthorized(request: NextRequest): boolean {
  const expected = evolutionWebhookSecret();
  if (!expected) {
    return false;
  }

  const header =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  // Query só como fallback (Evolution por vezes não envia headers). Não uses CRON_SECRET aqui.
  const query = request.nextUrl.searchParams.get("webhook_secret") ?? "";

  return secretsEqual(header, expected) || secretsEqual(query, expected);
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const data = (record.data ?? record) as Record<string, unknown>;
  const message = (data.message ?? record.message) as Record<string, unknown> | undefined;
  if (!message) {
    return String(data.body ?? record.body ?? "");
  }
  if (typeof message.conversation === "string") {
    return message.conversation;
  }
  const extended = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (extended && typeof extended.text === "string") {
    return extended.text;
  }
  return "";
}

function extractPhone(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const data = (record.data ?? record) as Record<string, unknown>;
  const key = (data.key ?? record.key) as Record<string, unknown> | undefined;
  const jid = String(key?.remoteJid ?? data.sender ?? record.sender ?? "");
  return jid.replace(/@.*$/, "").replace(/\D/g, "");
}

function isFromMe(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload as Record<string, unknown>;
  const data = (record.data ?? record) as Record<string, unknown>;
  const key = (data.key ?? record.key) as Record<string, unknown> | undefined;
  return Boolean(key?.fromMe);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const ip = await clientIp();
  const allowed = await rateLimit({
    name: "evo-webhook",
    key: ip,
    limit: 60,
    windowSec: 60,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Demasiados pedidos" }, { status: 429 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (isFromMe(payload)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const instance =
    extractEvolutionInstance(payload) || request.headers.get("x-evolution-instance") || "";
  const business = await findBusinessByEvolutionInstance(instance);
  if (!business) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const text = extractText(payload).toLowerCase();
  const phone = normalizePhone(extractPhone(payload));

  if (!phone || !/(cancelar|cancela|desmarcar)/.test(text)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await cancelUpcomingByPhoneForBusiness(business.id, phone);
  return NextResponse.json({
    ok: result.success,
    cancelled: result.success,
    error: result.success ? undefined : result.error,
  });
}
