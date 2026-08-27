import { isResendConfigured } from "@/lib/config";
import { BRAND } from "@/lib/brand";
import { sendOutboundMessage } from "@/lib/notifications";

function ownerNotifyEmail() {
  return (process.env.OWNER_NOTIFY_EMAIL ?? "").trim() || BRAND.email;
}

async function sendResendEmail(to: string, subject: string, text: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `${BRAND.name} <${BRAND.email}>`,
      to: [to],
      subject,
      text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
}

export async function notifyOwnerAuthEvent(input: {
  kind: "register" | "login";
  name: string;
  email: string;
  businessName?: string | null;
  phone?: string | null;
  slug?: string | null;
  ip?: string | null;
}): Promise<void> {
  if (!isResendConfigured()) {
    console.warn("[email] Resend não configurado — aviso de", input.kind, "não enviado");
    return;
  }

  const label = input.kind === "register" ? "Novo registo" : "Login";
  const lines = [
    `${label} na ${BRAND.name}`,
    `Nome: ${input.name}`,
    `Email: ${input.email}`,
  ];
  if (input.businessName) {
    lines.push(`Negócio: ${input.businessName}`);
  }
  if (input.phone) {
    lines.push(`Telemóvel: ${input.phone}`);
  }
  if (input.slug) {
    lines.push(`Link: https://${BRAND.domain}/agendar/${input.slug}`);
  }
  if (input.ip) {
    lines.push(`IP: ${input.ip}`);
  }
  lines.push(`Quando: ${new Date().toISOString()}`);

  try {
    await sendResendEmail(
      ownerNotifyEmail(),
      `${label}: ${input.businessName || input.email}`,
      lines.join("\n"),
    );
  } catch (error) {
    console.error("[email] Falha a avisar o dono:", error);
  }
}

export async function sendPasswordResetLink(input: {
  email: string;
  name: string;
  phone?: string | null;
  url: string;
}): Promise<void> {
  const subject = `Redefinir palavra-passe — ${BRAND.name}`;
  const text = [
    `Olá ${input.name},`,
    `Recebemos um pedido para redefinir a palavra-passe da sua conta ${BRAND.name}.`,
    `Abra este link (válido 1 hora): ${input.url}`,
    "Se não foi você, ignore esta mensagem.",
  ].join("\n");

  if (isResendConfigured()) {
    await sendResendEmail(input.email, subject, text);
    return;
  }

  if (input.phone) {
    const result = await sendOutboundMessage(
      input.phone,
      `${BRAND.name}: para redefinir a palavra-passe, abra ${input.url}`,
    );
    if (result.ok) {
      return;
    }
  }

  throw new Error("Não foi possível enviar o link de redefinição");
}
