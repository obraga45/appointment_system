"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      toast.error("As palavras-passe não coincidem");
      return;
    }

    setPending(true);
    const result = await resetPassword({ token: token || "supabase-session", password });
    setPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Palavra-passe actualizada");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Link href="/" className="font-serif text-2xl font-semibold">
          MarcaJá
        </Link>
        <CardTitle className="mt-4">Nova palavra-passe</CardTitle>
        <CardDescription>Defina uma palavra-passe com pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Nova palavra-passe</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirmar</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "A guardar…" : "Guardar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
