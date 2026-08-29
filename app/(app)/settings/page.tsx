import { Suspense } from "react";
import { CardLoading } from "@/components/page-loading";
import { ScheduleExceptionsForm } from "@/components/schedule-exceptions-form";
import { DeleteAccountCard, SettingsForms } from "@/components/settings-forms";
import { WhatsAppStatusBlock } from "@/components/whatsapp-status-block";
import { requireUser } from "@/lib/auth";
import { publicBookingUrl } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { calendarDateInZone, DEFAULT_TIMEZONE } from "@/lib/timezone";

export default async function SettingsPage() {
  const user = await requireUser();
  const tz = user.timezone || DEFAULT_TIMEZONE;
  const today = calendarDateInZone(new Date(), tz);
  const [hours, exceptions] = await Promise.all([
    prisma.workingHour.findMany({
      where: { userId: user.id },
      orderBy: { dayOfWeek: "asc" },
    }),
    prisma.scheduleException.findMany({
      where: { userId: user.id, date: { gte: today } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: { id: true, date: true, startTime: true, endTime: true, note: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Definições</h1>
        <p className="text-sm text-muted-foreground">
          Perfil, WhatsApp, sinal de confirmação, link público e horário de funcionamento.
        </p>
      </div>
      <Suspense fallback={<CardLoading />}>
        <WhatsAppStatusBlock slug={user.slug} instance={user.evolutionInstance} />
      </Suspense>
      <SettingsForms
        publicUrl={publicBookingUrl(user.slug)}
        profile={{
          name: user.name,
          businessName: user.businessName,
          phone: user.phone,
          timezone: user.timezone,
          slug: user.slug,
        }}
        deposit={{
          enabled: user.depositEnabled,
          amount: user.depositAmount?.toString() ?? "",
          mbWay: user.depositMbWay ?? "",
          iban: user.depositIban ?? "",
        }}
        hours={hours}
      />
      <ScheduleExceptionsForm exceptions={exceptions} minDate={today} />
      <DeleteAccountCard businessName={user.businessName} />
    </div>
  );
}
