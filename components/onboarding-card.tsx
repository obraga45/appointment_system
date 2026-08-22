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
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal space-y-2 pl-5">
          <li className={hasServices ? "text-muted-foreground line-through" : undefined}>
            Crie pelo menos um serviço para os clientes marcarem em {host}.
          </li>
          <li className={whatsappConnected ? "text-muted-foreground line-through" : undefined}>
            Ligue o WhatsApp do negócio para as confirmações saírem automaticamente.
          </li>
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          {hasServices ? null : (
            <Button asChild>
              <Link href="/services">Criar o primeiro serviço</Link>
            </Button>
          )}
          {whatsappConnected ? null : (
            <Button variant={hasServices ? "default" : "outline"} asChild>
              <Link href="#whatsapp">Ligar WhatsApp</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
