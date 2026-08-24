"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await requestPasswordReset({
      email: String(form.get("email") ?? ""),
    });
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setSent(true);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Link href="/" className="font-serif text-2xl font-semibold">
          TemVagas
        </Link>
        <CardTitle className="mt-4">Recuperar palavra-passe</CardTitle>
        <CardDescription>
          Se existir uma conta com este email, enviamos um link válido por uma hora.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Pedido enviado. Verifique o email ou o WhatsApp associado à conta.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "A enviar…" : "Enviar link"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Voltar ao início de sessão
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
