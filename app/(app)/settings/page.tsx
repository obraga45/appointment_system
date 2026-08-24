import { Suspense } from "react";
import { CardLoading } from "@/components/page-loading";
import { SettingsForms } from "@/components/settings-forms";
import { WhatsAppStatusBlock } from "@/components/whatsapp-status-block";
import { requireUser } from "@/lib/auth";
import { publicBookingUrl } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireUser();
  const hours = await prisma.workingHour.findMany({
    where: { userId: user.id },
    orderBy: { dayOfWeek: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Definições</h1>
        <p className="text-sm text-muted-foreground">Perfil, WhatsApp, link público e horário de funcionamento.</p>
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
        hours={hours}
      />
    </div>
  );
}
