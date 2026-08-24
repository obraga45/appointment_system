import { isResendConfigured } from "@/lib/config";
import { BRAND } from "@/lib/brand";
import { sendOutboundMessage } from "@/lib/notifications";

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
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${BRAND.name} <${BRAND.email}>`,
        to: [input.email],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Resend HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
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
