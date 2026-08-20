"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { loginUser } from "@/actions/auth";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await loginUser({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col">
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Link href="/" className="font-serif text-2xl font-semibold">
            MarcaJá
          </Link>
          <CardTitle className="mt-4">Entrar</CardTitle>
          <CardDescription>Aceda ao painel do seu negócio.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "A entrar…" : "Entrar"}
            </Button>
          </form>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            <Link href={"/forgot-password" as Route} className="text-primary underline-offset-4 hover:underline">
              Esqueceu a palavra-passe?
            </Link>
          </p>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link href="/register" className="text-primary underline-offset-4 hover:underline">
              Criar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
    <SiteFooter />
    </div>
  );
}
