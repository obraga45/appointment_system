import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { NotificationType } from "@prisma/client";
import { isQstashVerifyConfigured, isProduction } from "@/lib/config";
import { sendAppointmentReminder } from "@/lib/reminders";
import { qstashReminderSchema } from "@/lib/validations";

async function isAuthorized(request: NextRequest, body: string): Promise<boolean> {
  if (isQstashVerifyConfigured()) {
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      return false;
    }
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });
    try {
      await receiver.verify({ signature, body });
      return true;
    } catch {
      return false;
    }
  }

  if (isProduction()) {
    return false;
  }

  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!(await isAuthorized(request, body))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = qstashReminderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const type =
    parsed.data.type === "REMINDER_24H"
      ? NotificationType.REMINDER_24H
      : NotificationType.REMINDER_2H;

  const result = await sendAppointmentReminder(parsed.data.appointmentId, type);

  if (!result.skipped && result.ok === false) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}
