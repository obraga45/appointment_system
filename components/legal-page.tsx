import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { BRAND } from "@/lib/brand";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-6">
        <Link href="/" className="font-serif text-2xl font-semibold">
          {BRAND.name}
        </Link>
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          Entrar
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <h1 className="font-serif text-3xl font-semibold">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
