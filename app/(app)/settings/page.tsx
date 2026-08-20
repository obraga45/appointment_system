import { SettingsForms } from "@/components/settings-forms";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireUser();
  const hours = await prisma.workingHour.findMany({
    where: { userId: user.id },
    orderBy: { dayOfWeek: "asc" },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Definições</h1>
        <p className="text-sm text-muted-foreground">Perfil, link público e horário de funcionamento.</p>
      </div>
      <SettingsForms
        publicUrl={`${appUrl}/book/${user.slug}`}
        profile={{
          name: user.name,
          businessName: user.businessName,
          phone: user.phone,
          timezone: user.timezone,
          slug: user.slug,
          evolutionInstance: user.evolutionInstance,
        }}
        hours={hours}
      />
    </div>
  );
}
