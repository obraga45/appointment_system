import { NextRequest, NextResponse } from "next/server";
import { expireUnpaidDeposits } from "@/lib/deposit-expire";
import { notifyDepositExpired, processReminderWindow, retryFailedReminders } from "@/lib/reminders";
import { secretsEqual } from "@/lib/secrets";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  return secretsEqual(auth, secret) || secretsEqual(headerSecret, secret);
}

async function run() {
  const expiredIds = await expireUnpaidDeposits();
  for (const id of expiredIds) {
    await notifyDepositExpired(id).catch((error) => {
      console.error("[cron/reminders] Aviso de sinal expirado falhou:", error);
    });
  }

  const [reminder24h, reminder2h, retried] = await Promise.all([
    processReminderWindow(24),
    processReminderWindow(2),
    retryFailedReminders(),
  ]);

  return {
    ok: true,
    ranAt: new Date().toISOString(),
    expiredDeposits: expiredIds.length,
    reminder24h,
    reminder2h,
    retried,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    return NextResponse.json(await run());
  } catch (error) {
    console.error("[cron/reminders]", error);
    return NextResponse.json({ error: "Falha ao processar lembretes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
