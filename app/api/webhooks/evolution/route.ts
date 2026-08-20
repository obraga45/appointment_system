import { NextRequest, NextResponse } from "next/server";
import { cancelUpcomingByPhone } from "@/actions/appointments";
import { normalizePhone } from "@/lib/utils";

function isAuthorized(request: NextRequest): boolean {
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET || process.env.CRON_SECRET;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const querySecret = request.nextUrl.searchParams.get("secret");
  const header =
    request.headers.get("apikey") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (webhookSecret && querySecret === webhookSecret) {
    return true;
  }
  if (apiKey && header === apiKey) {
    return true;
  }
  return false;
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

  const payload = (await request.json().catch(() => null)) as unknown;
  if (isFromMe(payload)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const text = extractText(payload).toLowerCase();
  const phone = normalizePhone(extractPhone(payload));

  if (!phone || !/(cancelar|cancela|desmarcar)/.test(text)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await cancelUpcomingByPhone(phone);
  return NextResponse.json({
    ok: result.success,
    cancelled: result.success,
    error: result.success ? undefined : result.error,
  });
}
