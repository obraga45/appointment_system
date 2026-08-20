import { NextRequest, NextResponse } from "next/server";
import { processReminderWindow, retryFailedReminders } from "@/lib/reminders";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

async function run() {
  const [reminder24h, reminder2h, retried] = await Promise.all([
    processReminderWindow(24),
    processReminderWindow(2),
    retryFailedReminders(),
  ]);

  return {
    ok: true,
    ranAt: new Date().toISOString(),
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
