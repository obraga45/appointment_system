import { formatInTimeZone } from "date-fns-tz";
import { pt } from "date-fns/locale";
import { isTwilioSmsConfigured, readEnv } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatPhoneDisplay, normalizePhone } from "@/lib/utils";

export type MessageProvider = "evolution" | "zapi" | "twilio" | "sms";

export type SendMessageResult = {
  ok: boolean;
  provider: MessageProvider | "none";
  channel?: "whatsapp" | "sms";
  error?: string;
};

function getProvider(): MessageProvider | "none" {
  const value = (readEnv("MESSAGE_PROVIDER") || "evolution").toLowerCase();
  if (value === "evolution" || value === "zapi" || value === "twilio") {
    return value;
  }
  return "none";
}

function isConfigured(provider: MessageProvider | "none"): boolean {
  if (provider === "evolution") {
    return Boolean(readEnv("EVOLUTION_API_URL") && readEnv("EVOLUTION_API_KEY"));
  }
  if (provider === "zapi") {
    return Boolean(readEnv("ZAPI_INSTANCE_ID") && readEnv("ZAPI_TOKEN"));
  }
  if (provider === "twilio") {
    return Boolean(
      readEnv("TWILIO_ACCOUNT_SID") &&
        readEnv("TWILIO_AUTH_TOKEN") &&
        readEnv("TWILIO_FROM_NUMBER"),
    );
  }
  return false;
}

async function postJson(url: string, body: unknown, headers: HeadersInit) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
}

async function sendViaEvolution(phone: string, message: string, instanceName?: string | null) {
  const base = readEnv("EVOLUTION_API_URL").replace(/\/$/, "");
  const instance = instanceName || readEnv("EVOLUTION_INSTANCE");
  if (!instance) {
    throw new Error("Instância Evolution não configurada");
  }
  await postJson(
    `${base}/message/sendText/${instance}`,
    { number: phone, text: message },
    { apikey: readEnv("EVOLUTION_API_KEY") },
  );
}

async function sendViaZapi(phone: string, message: string) {
  const instance = process.env.ZAPI_INSTANCE_ID!;
  const token = process.env.ZAPI_TOKEN!;
  const headers: HeadersInit = {};
  if (process.env.ZAPI_CLIENT_TOKEN) {
    headers["Client-Token"] = process.env.ZAPI_CLIENT_TOKEN;
  }
  await postJson(
    `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
    { phone, message },
    headers,
  );
}

async function sendViaTwilio(phone: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const params = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:+${phone}`,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Twilio HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
}

function twilioSmsFrom(): string | null {
  const raw = readEnv("TWILIO_SMS_FROM") || readEnv("TWILIO_FROM_NUMBER");
  if (!raw) {
    return null;
  }
  const stripped = raw.replace(/^whatsapp:/i, "").trim();
  if (!stripped) {
    return null;
  }
  if (stripped.startsWith("+")) {
    return stripped;
  }
  const digits = stripped.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

async function sendViaTwilioSms(phone: string, message: string) {
  const sid = readEnv("TWILIO_ACCOUNT_SID");
  const from = twilioSmsFrom();
  if (!sid || !from) {
    throw new Error("SMS não configurado");
  }

  const params = new URLSearchParams({
    From: from,
    To: `+${phone}`,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${readEnv("TWILIO_AUTH_TOKEN")}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Twilio SMS HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
}

async function numberHasWhatsApp(phone: string, instanceName?: string | null): Promise<boolean | null> {
  if (getProvider() !== "evolution" || !isConfigured("evolution")) {
    return null;
  }

  const instance = instanceName || readEnv("EVOLUTION_INSTANCE");
  if (!instance) {
    return null;
  }

  try {
    const base = readEnv("EVOLUTION_API_URL").replace(/\/$/, "");
    const response = await fetch(`${base}/chat/whatsappNumbers/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: readEnv("EVOLUTION_API_KEY"),
      },
      body: JSON.stringify({ numbers: [phone] }),
    });
    if (!response.ok) {
      return null;
    }
    const data: unknown = await response.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row === "object" && "exists" in row && typeof row.exists === "boolean") {
      return row.exists;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendSmsMessage(phone: string, message: string): Promise<SendMessageResult> {
  const normalized = normalizePhone(phone);

  if (!normalized || normalized.length < 9) {
    return { ok: false, provider: "sms", channel: "sms", error: "Número de telemóvel inválido" };
  }

  if (!isTwilioSmsConfigured()) {
    return { ok: false, provider: "sms", channel: "sms", error: "SMS não configurado" };
  }

  const destOk = await rateLimit({
    name: "sms-dest",
    key: normalized,
    limit: 6,
    windowSec: 60 * 60 * 24,
  });
  const globalOk = await rateLimit({
    name: "sms-global",
    key: "all",
    limit: 120,
    windowSec: 60 * 60 * 24,
  });
  if (!destOk || !globalOk) {
    console.warn("[notifications] SMS recusado por limite diário");
    return { ok: false, provider: "sms", channel: "sms", error: "Limite diário de SMS atingido" };
  }

  try {
    await sendViaTwilioSms(normalized, message);
    return { ok: true, provider: "sms", channel: "sms" };
  } catch (error) {
    const description = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[notifications] Falha no SMS:", description);
    return { ok: false, provider: "sms", channel: "sms", error: description };
  }
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  instanceName?: string | null,
): Promise<SendMessageResult> {
  const provider = getProvider();
  const normalized = normalizePhone(phone);

  if (!normalized || normalized.length < 9) {
    return { ok: false, provider, channel: "whatsapp", error: "Número de telemóvel inválido" };
  }

  if (!isConfigured(provider) || provider === "none") {
    console.warn(
      `[notifications] Fornecedor "${provider}" não configurado. Mensagem para ${formatPhoneDisplay(normalized)} não enviada.`,
    );
    return {
      ok: false,
      provider,
      channel: "whatsapp",
      error: "Fornecedor de mensagens não configurado",
    };
  }

  try {
    if (provider === "evolution") {
      await sendViaEvolution(normalized, message, instanceName);
    } else if (provider === "zapi") {
      await sendViaZapi(normalized, message);
    } else {
      await sendViaTwilio(normalized, message);
    }

    return { ok: true, provider, channel: "whatsapp" };
  } catch (error) {
    const description = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[notifications] Falha no WhatsApp:", description);
    return { ok: false, provider, channel: "whatsapp", error: description };
  }
}

function mergeSendErrors(whatsapp: SendMessageResult, sms: SendMessageResult): string {
  return [whatsapp.error, sms.error].filter(Boolean).join(" · ") || "Falha no envio";
}

/** WhatsApp first; SMS if the number has no WhatsApp or WhatsApp fails. */
export async function sendOutboundMessage(
  phone: string,
  message: string,
  instanceName?: string | null,
): Promise<SendMessageResult> {
  const onWhatsApp = await numberHasWhatsApp(normalizePhone(phone), instanceName);

  if (onWhatsApp !== false) {
    const whatsapp = await sendWhatsAppMessage(phone, message, instanceName);
    if (whatsapp.ok) {
      return whatsapp;
    }
    const sms = await sendSmsMessage(phone, message);
    if (sms.ok) {
      return sms;
    }
    return { ok: false, provider: whatsapp.provider, error: mergeSendErrors(whatsapp, sms) };
  }

  const sms = await sendSmsMessage(phone, message);
  if (sms.ok) {
    return sms;
  }

  const whatsapp = await sendWhatsAppMessage(phone, message, instanceName);
  if (whatsapp.ok) {
    return whatsapp;
  }
  return { ok: false, provider: "sms", channel: "sms", error: mergeSendErrors(whatsapp, sms) };
}

/** Salon alerts prefer SMS (cannot reliably WhatsApp the same linked number). */
export async function sendBusinessAlert(
  phone: string,
  message: string,
  instanceName?: string | null,
): Promise<SendMessageResult> {
  const sms = await sendSmsMessage(phone, message);
  if (sms.ok) {
    return sms;
  }
  const whatsapp = await sendWhatsAppMessage(phone, message, instanceName);
  if (whatsapp.ok) {
    return whatsapp;
  }
  return { ok: false, provider: whatsapp.provider, error: mergeSendErrors(whatsapp, sms) };
}

function whenLabel(startTime: Date, timeZone: string) {
  return formatInTimeZone(startTime, timeZone, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: pt });
}

export function buildConfirmationMessage(input: {
  businessName: string;
  clientName: string;
  serviceName: string;
  startTime: Date;
  timeZone?: string;
  cancelUrl?: string;
}): string {
  const when = whenLabel(input.startTime, input.timeZone ?? DEFAULT_TIMEZONE);
  const lines = [
    `Olá ${input.clientName},`,
    `a sua marcação em ${input.businessName} está confirmada.`,
    `Serviço: ${input.serviceName}`,
    `Quando: ${when}`,
  ];
  if (input.cancelUrl) {
    lines.push(`Para cancelar: ${input.cancelUrl}`);
  }
  return lines.join("\n");
}

export function buildReminderMessage(input: {
  businessName: string;
  clientName: string;
  serviceName: string;
  startTime: Date;
  hoursAhead: 24 | 2;
  timeZone?: string;
  cancelUrl?: string;
}): string {
  const when = whenLabel(input.startTime, input.timeZone ?? DEFAULT_TIMEZONE);
  const window = input.hoursAhead === 24 ? "amanhã" : "dentro de 2 horas";
  const lines = [
    `Olá ${input.clientName},`,
    `lembrete: a sua marcação em ${input.businessName} é ${window}.`,
    `Serviço: ${input.serviceName}`,
    `Quando: ${when}`,
    "Até já!",
  ];
  if (input.cancelUrl) {
    lines.push(`Cancelar: ${input.cancelUrl}`);
  } else {
    lines.push("Para cancelar, use o link da mensagem de confirmação.");
  }
  return lines.join("\n");
}

export function buildCancelConfirmationMessage(input: {
  businessName: string;
  clientName: string;
}): string {
  return `Olá ${input.clientName}, a sua marcação em ${input.businessName} foi cancelada.`;
}

export function buildBusinessAlertMessage(input: {
  businessName: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  startTime: Date;
  timeZone?: string;
}): string {
  const when = whenLabel(input.startTime, input.timeZone ?? DEFAULT_TIMEZONE);
  return [
    `Nova marcação em ${input.businessName}`,
    `Cliente: ${input.clientName}`,
    `Telemóvel: ${formatPhoneDisplay(input.clientPhone)}`,
    `Serviço: ${input.serviceName}`,
    `Quando: ${when}`,
  ].join("\n");
}

export function buildBusinessCancelMessage(input: {
  businessName: string;
  clientName: string;
  serviceName?: string;
  startTime?: Date;
  timeZone?: string;
}): string {
  const lines = [
    `Marcação cancelada em ${input.businessName}`,
    `Cliente: ${input.clientName}`,
  ];
  if (input.serviceName) {
    lines.push(`Serviço: ${input.serviceName}`);
  }
  if (input.startTime) {
    lines.push(`Quando: ${whenLabel(input.startTime, input.timeZone ?? DEFAULT_TIMEZONE)}`);
  }
  return lines.join("\n");
}
