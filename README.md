# TemVagas — Marcações e lembretes WhatsApp

Produto para PMEs: link público de agendamento, painel do profissional e confirmações/lembretes no WhatsApp do negócio.

Site: https://temvagas.pt  
Email: info@temvagas.pt  
Preço: **15€/mês** ou **149€ no primeiro ano** (pagamento único inicial por MB Way/transferência).

## Stack

- **Next.js 15** (App Router) na Vercel
- **PostgreSQL** (Supabase)
- **Prisma ORM**
- **Auth local** (cookie) ou **Supabase Auth**
- **Evolution API** (WhatsApp do negócio) / Z-API
- **Upstash QStash** para lembretes; **Vercel Cron** como rede de segurança

A cobrança recorrente (Stripe) ainda não está no código: o 1.º período paga-se à mão.

O espaço pode pedir um sinal (ex.: 5€) para confirmar marcações no link público. O cliente paga por MB Way ou IBAN **directo ao salão**; a TemVagas não processa esse dinheiro. O horário fica reservado 45 minutos até o profissional confirmar no painel.

## Arranque local

```bash
docker compose up -d postgres
copy .env.example .env
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

Conta demo **apenas local** (depois de `npm run db:seed`): o terminal mostra o email e a password.
Não cries esta conta em produção.

Página pública local: http://localhost:3000/agendar/salao-oliveira

Em produção, `NEXT_PUBLIC_APP_URL=https://temvagas.pt`. `SESSION_SECRET` e `CRON_SECRET` devem ser valores longos e aleatórios.

## Produção

App: Vercel (domínio temvagas.pt) · BD: Supabase.

Links antigos `/book/...` redireccionam para `/agendar/...`.

### WhatsApp + lembretes

Ver `deploy/evolution`. Cada negócio liga o próprio WhatsApp (QR). Confirmações e lembretes saem no WhatsApp do negócio; o cliente deixa um número com WhatsApp. O telemóvel do negócio pode receber aviso de marcações novas. Variáveis na Vercel: `MESSAGE_PROVIDER`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET`, e opcionalmente QStash / Resend (`EMAIL_FROM=TemVagas <info@temvagas.pt>`).

Webhook: `POST /api/webhooks/evolution` com o header `x-webhook-secret` (valor de `EVOLUTION_WEBHOOK_SECRET`, não o `CRON_SECRET`). Mensagens com «cancelar» desmarcam a próxima visita desse número.

## Fluxos

| Rota | Função |
| --- | --- |
| `/register`, `/login`, `/forgot-password` | Conta do profissional |
| `/dashboard` | Agenda do dia + onboarding |
| `/appointments` | Lista do dia/semana |
| `/services` | Serviços |
| `/settings` | Perfil, WhatsApp, sinal opcional, link, horários |
| `/agendar/[slug]` | Página pública do cliente |
| `/agendar/cancel/[token]` | Cancelamento pelo cliente |
| `/termos`, `/privacidade` | Textos legais |
