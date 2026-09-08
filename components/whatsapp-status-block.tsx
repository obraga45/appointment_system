import { OnboardingCard } from "@/components/onboarding-card";
import { WhatsAppConnectCard } from "@/components/whatsapp-connect-card";
import { evolutionInstanceName, getEvolutionState, isEvolutionApiReady } from "@/lib/evolution";

export async function WhatsAppStatusBlock({
  slug,
  instance,
  defaultPhone,
  hasServices,
  publicUrl,
  showOnboarding = false,
}: {
  slug: string;
  instance: string | null;
  defaultPhone?: string | null;
  hasServices?: boolean;
  publicUrl?: string;
  showOnboarding?: boolean;
}) {
  const configured = isEvolutionApiReady();
  const state = configured
    ? await getEvolutionState(evolutionInstanceName(instance || slug))
    : "unknown";
  const connected = state === "open";

  return (
    <>
      {showOnboarding && publicUrl ? (
        <OnboardingCard
          hasServices={Boolean(hasServices)}
          whatsappConnected={connected}
          publicUrl={publicUrl}
        />
      ) : null}
      <WhatsAppConnectCard
        defaultPhone={defaultPhone ?? ""}
        initial={{
          configured,
          connected,
          state,
          qr: null,
          pairingCode: null,
        }}
      />
    </>
  );
}
