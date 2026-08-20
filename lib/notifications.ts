import { formatInTimeZone } from "date-fns-tz";
import { pt } from "date-fns/locale";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { formatPhoneDisplay, normalizePhone } from "@/lib/utils";

export type MessageProvider = "evolution" | "zapi" | "twilio";

export type SendMessageResult = {
  ok: boolean;
  provider: MessageProvider | "none";
  error?: string;
};

function getProvider(): MessageProvider | "none" {
  const value = (process.env.MESSAGE_PROVIDER ?? "evolution").toLowerCase();
  if (value === "evolution" || value === "zapi" || value === "twilio") {
    return value;
  }
  return "none";
}

function isConfigured(provider: MessageProvider | "none"): boolean {
  if (provider === "evolution") {
    return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
  }
  if (provider === "zapi") {
    return Boolean(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN);
  }
  if (provider === "twilio") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER,
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
  const base = process.env.EVOLUTION_API_URL!.replace(/\/$/, "");
  const instance = instanceName || process.env.EVOLUTION_INSTANCE;
  if (!instance) {
    throw new Error("Instância Evolution não configurada");
  }
  await postJson(
    `${base}/message/sendText/${instance}`,
    { number: phone, text: message },
    { apikey: process.env.EVOLUTION_API_KEY! },
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

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  instanceName?: string | null,
): Promise<SendMessageResult> {
  const provider = getProvider();
  const normalized = normalizePhone(phone);

  if (!normalized || normalized.length < 9) {
    return { ok: false, provider, error: "Número de telemóvel inválido" };
  }

  if (!isConfigured(provider) || provider === "none") {
    console.warn(
      `[notifications] Fornecedor "${provider}" não configurado. Mensagem para ${formatPhoneDisplay(normalized)} não enviada.`,
    );
    return {
      ok: false,
      provider,
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

    return { ok: true, provider };
  } catch (error) {
    const description = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[notifications] Falha no envio:", description);
    return { ok: false, provider, error: description };
  }
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
  }
  return lines.join("\n");
}

export function buildCancelConfirmationMessage(input: {
  businessName: string;
  clientName: string;
}): string {
  return `Olá ${input.clientName}, a sua marcação em ${input.businessName} foi cancelada.`;
}
