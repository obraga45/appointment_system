import Link from "next/link";
import { Bell, CalendarClock, MessageCircle, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top_left,oklch(0.93_0.04_85),transparent_40%),radial-gradient(circle_at_bottom_right,oklch(0.9_0.05_162),transparent_35%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <span className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">MarcaJá</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Criar conta</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pb-24 sm:pt-10">
        <section className="max-w-3xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-primary sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
            Para salões, clínicas e oficinas
          </p>
          <h1 className="font-serif text-[2rem] leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Marcações simples. Lembretes no WhatsApp, a horas.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Um painel leve para gerir o dia, um link público para os clientes marcarem sozinhos,
            e confirmações automáticas por WhatsApp ou SMS.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/register">Começar agora</Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href="/login">Já tenho conta</Link>
            </Button>
          </div>
        </section>

        <section className="mt-12 grid flex-1 gap-4 sm:mt-20 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: CalendarClock,
              title: "Agenda do dia",
              body: "Lista e calendário com as marcações da semana, sem folhas Excel.",
            },
            {
              icon: MessageCircle,
              title: "WhatsApp / SMS",
              body: "Confirmação imediata e lembretes 24h e 2h antes, via Evolution, Z-API ou Twilio.",
            },
            {
              icon: Bell,
              title: "Link do cliente",
              body: "O cliente escolhe serviço, horário livre e deixa o telemóvel. Sem chamadas.",
            },
            {
              icon: ShieldCheck,
              title: "Supabase + Prisma",
              body: "Auth, PostgreSQL e horários de funcionamento por negócio, prontos para produção.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
              <item.icon className="mb-3 h-5 w-5 text-primary sm:mb-4" />
              <h2 className="font-medium">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
