# MarcaJá — Sistema de Marcações e Lembretes

Aplicação web para PMEs gerirem agendamentos, com página pública de marcação e envio automático de confirmações e lembretes por WhatsApp / SMS.

## Stack

- **Next.js 15** (App Router, Server Actions, TypeScript) na Vercel
- **PostgreSQL** (Hetzner Docker ou Supabase)
- **Prisma ORM**
- **Auth local** (cookie) ou **Supabase Auth**
- **Evolution API / Z-API / Twilio** para mensagens (Evolution no Hetzner)
- **Upstash QStash** para lembretes à hora certa; **Vercel Cron** como rede de segurança
- **Upstash Redis** para rate limit (opcional em dev)

Stripe não está incluído: a cobrança é feita à parte.

## Arranque local

```bash
docker compose up -d postgres
copy .env.example .env
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

Conta demo: `demo@marcaja.pt` / `demo1234`  
Página pública: http://localhost:3000/book/salao-oliveira

Em `.env`, `SESSION_SECRET` e `CRON_SECRET` devem ser valores longos e aleatórios em produção.

## Produção (Vercel + Hetzner)

1. **Hetzner — Postgres** (VPS separado da Evolution, backups activos). Preencha `DATABASE_URL` (PgBouncer/pooler) e `DIRECT_URL` (ligação directa para migrations).
2. **Hetzner — Evolution API** noutro VPS. Defina `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`. Cada negócio pode ter instância própria em Definições.
3. **Vercel** — região `fra1`, `NEXT_PUBLIC_APP_URL` no domínio real, `SESSION_SECRET` forte.
4. **Upstash QStash** — `QSTASH_TOKEN` + chaves de assinatura. Ao criar uma marcação, agenda T-24h e T-2h. Sem QStash, o cron diário (Hobby) envia o lembrete de 24h de manhã; o de 2h precisa de QStash ou plano Pro.
5. **Upstash Redis** — rate limit no booking público.
6. **Resend** (opcional) — emails de reset de palavra-passe. Sem Resend, o link vai por WhatsApp se o negócio tiver telemóvel.
7. Webhook Evolution: `POST /api/webhooks/evolution` com header `apikey`. Mensagens com «cancelar» desmarcam a próxima visita desse número.
8. `npx prisma migrate deploy` na primeira subida.

O cron em `vercel.json` corre de hora a hora e precisa de `Authorization: Bearer $CRON_SECRET`. No plano Hobby da Vercel o cron pode ser só diário — use QStash.

## Modelos (Prisma)

- `User` — empresa/profissional (`slug` em `/book/[businessSlug]`), fuso e instância Evolution opcional
- `Service` — serviços oferecidos
- `Appointment` — marcações + `cancelToken` para `/book/cancel/[token]`
- `NotificationLog` — confirmação, lembrete 24h e 2h
- `WorkingHour` — horário por dia da semana
- `PasswordResetToken` — recuperação de acesso (auth local)

## Fluxos

| Rota | Função |
| --- | --- |
| `/register`, `/login`, `/forgot-password` | Conta do profissional |
| `/dashboard` | Agenda do dia + onboarding |
| `/appointments` | Lista do dia/semana + estados |
| `/appointments/new` | Marcação manual (dispara confirmação) |
| `/services` | CRUD de serviços |
| `/settings` | Perfil, link público, fuso, horários, instância WhatsApp |
| `/book/[businessSlug]` | Página pública do cliente |
| `/book/cancel/[token]` | Cancelamento pelo cliente |
| `/termos`, `/privacidade` | Textos legais |
| `/api/cron/reminders` | Rede de segurança 24h / 2h + retry |
| `/api/qstash/reminders` | Lembretes agendados |
| `/api/webhooks/evolution` | «Cancelar» por WhatsApp |
