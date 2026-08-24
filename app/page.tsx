import Link from "next/link";
import { CalendarClock, Link2, MessageCircle } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top_left,oklch(0.93_0.04_85),transparent_40%),radial-gradient(circle_at_bottom_right,oklch(0.9_0.05_162),transparent_35%)]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <span className="font-serif text-xl font-semibold tracking-tight sm:text-2xl">{BRAND.name}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Criar conta</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pb-24 sm:pt-10">
        <section className="max-w-3xl">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-primary sm:mb-4 sm:text-sm sm:tracking-[0.2em]">
            Para salões, clínicas e oficinas
          </p>
          <h1 className="font-serif text-[2rem] leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Os clientes marcam sozinhos. Tu recebes o lembrete no WhatsApp.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Um link do teu espaço, agenda no telemóvel, confirmação e lembretes 24h e 2h antes — no
            WhatsApp do teu negócio.
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

        <section className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-3">
          {[
            {
              icon: CalendarClock,
              step: "1",
              title: "Crias os serviços",
              body: "Corte, coloração, consulta — com duração e preço.",
            },
            {
              icon: Link2,
              step: "2",
              title: "Partilhas o link",
              body: `${BRAND.domain}/agendar/o-teu-salao — o cliente vê o que está ocupado e escolhe um horário livre.`,
            },
            {
              icon: MessageCircle,
              step: "3",
              title: "O WhatsApp lembra",
              body: "Confirmação na hora. Lembretes no dia anterior e 2 horas antes. É o teu número, não o nosso.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Passo {item.step}</p>
              <item.icon className="mt-3 h-5 w-5 text-primary" />
              <h2 className="mt-3 font-medium">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </section>

        <section id="precos" className="mt-16 max-w-3xl sm:mt-20">
          <h2 className="font-serif text-3xl font-semibold">Preço simples</h2>
          <p className="mt-2 text-muted-foreground">
            Um espaço, um link, lembretes incluídos. O primeiro ano paga-se de uma vez. O débito
            mensal automático vem mais tarde.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Mensal</p>
              <p className="mt-1 font-serif text-4xl font-semibold">{BRAND.monthlyPrice}</p>
              <p className="mt-1 text-sm text-muted-foreground">por mês, um espaço</p>
            </article>
            <article className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-sm">
              <p className="text-sm font-medium text-primary">Primeiro ano</p>
              <p className="mt-1 font-serif text-4xl font-semibold">{BRAND.yearlyPrice}</p>
              <p className="mt-1 text-sm text-muted-foreground">pago de uma vez · equivale a 10 meses</p>
            </article>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Pagamento inicial por MB Way ou transferência. Envia comprovativo para{" "}
            <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${BRAND.email}`}>
              {BRAND.email}
            </a>
            . Podes criar conta e testar o link antes de pagar.
          </p>
        </section>

        <section className="mt-16 max-w-2xl sm:mt-20">
          <h2 className="font-serif text-2xl font-semibold">Perguntas frequentes</h2>
          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="font-medium">O WhatsApp é da TemVagas?</dt>
              <dd className="mt-1 text-muted-foreground">
                Não. Ligas o WhatsApp do teu negócio com um QR. As mensagens saem no teu nome.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Como é o link dos clientes?</dt>
              <dd className="mt-1 text-muted-foreground">
                {BRAND.domain}/agendar/nome-do-salao — cada espaço tem o seu.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Posso cancelar?</dt>
              <dd className="mt-1 text-muted-foreground">
                Sim. O plano é mensal ou anual; não há fidelização para além do período já pago.
              </dd>
            </div>
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
