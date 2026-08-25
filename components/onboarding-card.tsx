import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OnboardingCard({
  hasServices,
  whatsappConnected,
  publicUrl,
}: {
  hasServices: boolean;
  whatsappConnected: boolean;
  publicUrl: string;
}) {
  if (hasServices && whatsappConnected) {
    return null;
  }

  const host = publicUrl.replace(/^https?:\/\//, "");

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="font-serif text-xl">Primeiros passos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hasServices ? (
          <p className="text-sm text-muted-foreground line-through">Serviço criado para {host}</p>
        ) : (
          <Button asChild className="h-auto w-full justify-start whitespace-normal py-3 text-left">
            <Link href="/services">Criar o primeiro serviço para os clientes marcarem em {host}</Link>
          </Button>
        )}
        {whatsappConnected ? (
          <p className="text-sm text-muted-foreground line-through">WhatsApp do negócio ligado</p>
        ) : (
          <Button
            asChild
            variant={hasServices ? "default" : "outline"}
            className="h-auto w-full justify-start whitespace-normal py-3 text-left"
          >
            <Link href="#whatsapp">Ligar o WhatsApp do negócio</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
