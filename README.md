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

## Produção (já no ar)

App: Vercel · BD: Supabase · Migrations: aplicadas.

### Fechar WhatsApp + lembretes (ordem)

**1. Hetzner CX32** (Falkenstein/Helsinki), Ubuntu, Docker:

```bash
apt update && apt install -y docker.io docker-compose-v2
ufw allow 22 && ufw allow 8080 && ufw --force enable
```

Copia a pasta `deploy/evolution` para o VPS, `cp .env.example .env`, preenche `SERVER_URL=http://IP:8080`, `AUTHENTICATION_API_KEY`, `EVOLUTION_DB_PASSWORD` e o `WEBHOOK_GLOBAL_URL` com o `CRON_SECRET` da Vercel. Depois:

```bash
docker compose up -d
```

Cria a instância e lê o QR no JSON:

```powershell
curl.exe -X POST "http://IP:8080/instance/create" -H "apikey: A_TUA_CHAVE" -H "Content-Type: application/json" -d "{\"instanceName\":\"marcaja\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}"
```

Abre WhatsApp no telemóvel → Aparelhos ligados → Ler QR (campo `base64` da resposta, ou GET `/instance/connect/marcaja`).

**2. Vercel → Environment Variables** (Production), depois Redeploy:

| Key | Valor |
| --- | --- |
| `MESSAGE_PROVIDER` | `evolution` |
| `EVOLUTION_API_URL` | `http://IP:8080` |
| `EVOLUTION_API_KEY` | a mesma `AUTHENTICATION_API_KEY` |
| `EVOLUTION_INSTANCE` | `marcaja` |
| `EVOLUTION_WEBHOOK_SECRET` | o mesmo `CRON_SECRET` |

**3. Upstash** (conta grátis) → Redis REST URL + token; QStash token + duas signing keys. Cola `UPSTASH_*` e `QSTASH_*` na Vercel. Sem QStash, o Hobby só lembra 1×/dia (24h).

**4. Resend** (opcional): `RESEND_API_KEY` + `EMAIL_FROM`. Sem isto, o reset de password tenta WhatsApp.

**5. Teste:** nova marcação no site com o teu telemóvel. Deves receber confirmação no WhatsApp. Responder `cancelar` desmarca.

Webhook: `POST /api/webhooks/evolution?secret=CRON_SECRET`. Mensagens com «cancelar» desmarcam a próxima visita desse número.

O cron Hobby corre às 08:00 UTC. Plano Pro: `"0 * * * *"` em `vercel.json`.

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
