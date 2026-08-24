import { SettingsForms } from "@/components/settings-forms";
import { WhatsAppConnectCard } from "@/components/whatsapp-connect-card";
import { requireUser } from "@/lib/auth";
import { publicBookingUrl } from "@/lib/config";
import { evolutionInstanceName, getEvolutionConnection } from "@/lib/evolution";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireUser();
  const hours = await prisma.workingHour.findMany({
    where: { userId: user.id },
    orderBy: { dayOfWeek: "asc" },
  });
  const whatsapp = await getEvolutionConnection(evolutionInstanceName(user.evolutionInstance || user.slug));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Definições</h1>
        <p className="text-sm text-muted-foreground">Perfil, WhatsApp, link público e horário de funcionamento.</p>
      </div>
      <WhatsAppConnectCard
        initial={{
          configured: whatsapp.configured,
          connected: whatsapp.state === "open",
          state: whatsapp.state,
          qr: whatsapp.qr,
        }}
      />
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
