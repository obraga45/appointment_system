"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerUser } from "@/actions/auth";
import { startPageProgress } from "@/components/navigation-progress";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";

export default function RegisterPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await registerUser({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      businessName: String(form.get("businessName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      acceptTerms: form.get("acceptTerms") === "on",
    });
    if (!result.success) {
      setPending(false);
      toast.error(result.error);
      return;
    }

    toast.success("Conta criada. Bem-vindo.");
    startPageProgress();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="font-serif text-2xl font-semibold">
            TemVagas
          </Link>
          <CardTitle className="mt-4">Criar conta</CardTitle>
          <CardDescription>
            Configura o negócio em menos de um minuto. Podes testar o link; o 1.º ano ({BRAND.yearlyPrice})
            paga-se depois para {BRAND.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">O seu nome</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="businessName">Nome do negócio</Label>
              <Input id="businessName" name="businessName" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telemóvel</Label>
              <Input id="phone" name="phone" placeholder="+351 9xx xxx xxx" />
              <p className="text-xs text-muted-foreground">
                Para receber um aviso quando um cliente marca.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input id="acceptTerms" name="acceptTerms" type="checkbox" className="mt-1" required />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" className="text-primary underline-offset-4 hover:underline">
                  termos
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" className="text-primary underline-offset-4 hover:underline">
                  política de privacidade
                </Link>
                .
              </span>
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "A criar…" : "Criar conta"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
