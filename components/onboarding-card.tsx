import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OnboardingCard({
  hasServices,
  publicUrl,
}: {
  hasServices: boolean;
  publicUrl: string;
}) {
  if (hasServices) {
    return null;
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="font-serif text-xl">Primeiros passos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Crie pelo menos um serviço para os clientes poderem marcar em {publicUrl.replace(/^https?:\/\//, "")}.</p>
        <Button asChild>
          <Link href="/services">Criar o primeiro serviço</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
