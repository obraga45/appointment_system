import { formatInTimeZone } from "date-fns-tz";
import { pt } from "date-fns/locale";
import { readEnv } from "@/lib/config";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatPhoneDisplay, normalizePhone } from "@/lib/utils";

export type MessageProvider = "evolution" | "zapi";

export type SendMessageResult = {
  ok: boolean;
  provider: MessageProvider | "none";
  channel?: "whatsapp";
  error?: string;
};

function getProvider(): MessageProvider | "none" {
  const value = (readEnv("MESSAGE_PROVIDER") || "evolution").toLowerCase();
  if (value === "evolution" || value === "zapi") {
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
    } else {
      await sendViaZapi(normalized, message);
    }

    return { ok: true, provider, channel: "whatsapp" };
  } catch (error) {
    const description = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[notifications] Falha no WhatsApp:", description);
    return { ok: false, provider, channel: "whatsapp", error: description };
  }
}

export async function sendOutboundMessage(
  phone: string,
  message: string,
  instanceName?: string | null,
): Promise<SendMessageResult> {
  return sendWhatsAppMessage(phone, message, instanceName);
}

export async function sendBusinessAlert(
  phone: string,
  message: string,
  instanceName?: string | null,
): Promise<SendMessageResult> {
  return sendWhatsAppMessage(phone, message, instanceName);
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
