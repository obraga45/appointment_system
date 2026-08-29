/**
 * Pre-production checks that do not apply migrations to the live database.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { AppointmentStatus, type WorkingHour } from "@prisma/client";
import {
  generateDaySlots,
  generateTimeSlots,
  isDateFullyBlocked,
  rangeOverlapsException,
} from "../lib/availability";
import { createBookingChallenge, verifyBookingChallenge } from "../lib/booking-challenge";
import { hashToken, newCancelToken } from "../lib/reminders";
import { secretsEqual } from "../lib/secrets";
import { readSessionToken, signSessionToken } from "../lib/session-token";
import { buildDepositRequestMessage, buildBusinessAlertMessage } from "../lib/notifications";
import { depositSettingsSchema, publicBookingSchema } from "../lib/validations";
import { extractEvolutionInstance } from "../lib/whatsapp-cancel";
import { extractEvolutionOwnerPhone } from "../lib/evolution";
import { businessAlertSenderInstance } from "../lib/notifications";

let failed = 0;
let passed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function testSession() {
  console.log("\nSessão");
  const userId = "11111111-2222-3333-4444-555555555555";
  const token = await signSessionToken(userId);
  assert("token tem 3 partes", token.split(".").length === 3);
  assert("lê o userId", (await readSessionToken(token)) === userId);
  assert("rejeita cookie antigo (2 partes)", (await readSessionToken("abc.deadbeef")) === null);
  assert("rejeita assinatura adulterada", (await readSessionToken(`${token}0`)) === null);
  assert("rejeita expirado", (await readSessionToken(token, Date.now() + 8 * 24 * 60 * 60 * 1000)) === null);
}

async function testChallenge() {
  console.log("\nDesafio de marcação");
  const now = Date.now();
  const fresh = await createBookingChallenge(now);
  assert("rejeita se for imediato (bot)", (await verifyBookingChallenge(fresh, now)) === false);
  assert("aceita após 1s", (await verifyBookingChallenge(fresh, now + 1500)) === true);
  assert("rejeita após 2h", (await verifyBookingChallenge(fresh, now + 3 * 60 * 60 * 1000)) === false);
  assert("rejeita adulterado", (await verifyBookingChallenge(`${fresh}x`, now + 1500)) === false);
  assert(
    "rejeita formato antigo sem nonce",
    (await verifyBookingChallenge(`${now}.deadbeef`, now + 1500)) === false,
  );
}

function testTokens() {
  console.log("\nTokens de cancelamento");
  const token = newCancelToken();
  const hashed = hashToken(token);
  assert("token tem 48 hex chars", /^[0-9a-f]{48}$/.test(token));
  assert("hash sha256 hex", hashed === createHash("sha256").update(token).digest("hex"));
  assert("hash tem 64 chars", hashed.length === 64);
}

function testSecrets() {
  console.log("\nComparação de secrets");
  assert("iguais", secretsEqual("abc", "abc"));
  assert("diferentes", !secretsEqual("abc", "xyz"));
  assert("esperado vazio falha", !secretsEqual("abc", ""));
}

function testWebhookParse() {
  console.log("\nWebhook Evolution");
  assert(
    "instance string",
    extractEvolutionInstance({ instance: "salao-oliveira", data: {} }) === "salao-oliveira",
  );
  assert(
    "instanceName no objecto",
    extractEvolutionInstance({ instance: { instanceName: "barbearia-x" } }) === "barbearia-x",
  );
  assert("vazio se faltar", extractEvolutionInstance({ data: {} }) === "");
}

function testBusinessAlertRouting() {
  console.log("\nAviso WhatsApp ao espaço");
  assert(
    "lê o número ligado ao QR",
    extractEvolutionOwnerPhone(
      { instanceName: "salao-x", ownerJid: "351920797741:12@s.whatsapp.net" },
      "salao-x",
    ) === "351920797741",
  );
  assert(
    "ignora outra instância",
    extractEvolutionOwnerPhone(
      [
        { instanceName: "outro", ownerJid: "351911111111@s.whatsapp.net" },
        { instanceName: "salao-x", ownerJid: "351922222222@s.whatsapp.net" },
      ],
      "salao-x",
    ) === "351922222222",
  );
  assert(
    "aviso ao próprio QR usa a TemVagas",
    businessAlertSenderInstance({
      destinationPhone: "920797741",
      businessInstance: "salao-x",
      connectedPhone: "351920797741",
      platformInstance: "marcaja",
    }) === "marcaja",
  );
  assert(
    "não envia do QR para o próprio número",
    businessAlertSenderInstance({
      destinationPhone: "351920797741",
      businessInstance: "salao-x",
      connectedPhone: "351920797741",
      platformInstance: "salao-x",
    }) === null,
  );
  assert(
    "telemóvel diferente usa o WhatsApp do espaço",
    businessAlertSenderInstance({
      destinationPhone: "351925000000",
      businessInstance: "salao-x",
      connectedPhone: "351920797741",
      platformInstance: "",
    }) === "salao-x",
  );
}

function testDeposit() {
  console.log("\nSinal de confirmação");
  assert(
    "desligado sem dados é válido",
    depositSettingsSchema.safeParse({ enabled: false, amount: 0, mbWay: "", iban: "" }).success,
  );
  assert(
    "ligado sem pagamento falha",
    depositSettingsSchema.safeParse({ enabled: true, amount: 5, mbWay: "", iban: "" }).success === false,
  );
  assert(
    "ligado com MB Way é válido",
    depositSettingsSchema.safeParse({ enabled: true, amount: 5, mbWay: "912345678", iban: "" }).success,
  );
  assert(
    "IBAN PT válido",
    depositSettingsSchema.safeParse({
      enabled: true,
      amount: 5,
      mbWay: "",
      iban: "PT50 0002 0123 1234 5678 9015 4",
    }).success,
  );
  const message = buildDepositRequestMessage({
    businessName: "Salão Oliveira",
    clientName: "Ana",
    serviceName: "Corte",
    startTime: new Date("2026-09-01T09:00:00.000Z"),
    amount: 5,
    holdMinutes: 45,
    mbWay: "351912345678",
    timeZone: "Europe/Lisbon",
  });
  assert("pedido de sinal inclui o valor", message.includes("5,00") || message.includes("5.00"));
  assert("pedido de sinal inclui MB Way", message.includes("912 345 678"));
  const alert = buildBusinessAlertMessage({
    businessName: "Salão Oliveira",
    clientName: "Ana",
    clientPhone: "351912345678",
    serviceName: "Corte",
    startTime: new Date("2026-09-01T09:00:00.000Z"),
    depositAmount: 5,
    depositHoldMinutes: 45,
    timeZone: "Europe/Lisbon",
  });
  assert("aviso ao espaço menciona o sinal", alert.includes("sinal"));
}

function testBookingSchema() {
  console.log("\nValidação de marcação pública");
  const base = {
    serviceId: "11111111-1111-4111-8111-111111111111",
    clientName: "Ana Silva",
    clientPhone: "912345678",
    date: "2026-09-01",
    time: "10:00",
  };
  assert("exige challenge", publicBookingSchema.safeParse(base).success === false);
  assert(
    "aceita com challenge",
    publicBookingSchema.safeParse({ ...base, challenge: "1234567890ab" }).success === true,
  );
}

function testAvailability() {
  console.log("\nDisponibilidade / encerramentos");
  const date = "2099-06-15";
  const timeZone = "Europe/Lisbon";
  const now = new Date("2020-01-01T00:00:00Z");
  const workingHour: WorkingHour = {
    id: "wh",
    userId: "u",
    dayOfWeek: 2,
    startTime: "09:00",
    endTime: "12:00",
    breakStart: "10:00",
    breakEnd: "10:30",
    isClosed: false,
  };

  assert("dia inteiro bloqueado", isDateFullyBlocked([{ date, startTime: null, endTime: null }], date));
  assert(
    "intervalo não é dia inteiro",
    !isDateFullyBlocked([{ date, startTime: "09:00", endTime: "10:00" }], date),
  );

  const closedSlots = generateDaySlots({
    date,
    timeZone,
    durationMinutes: 30,
    workingHour,
    existing: [],
    exceptions: [{ date, startTime: null, endTime: null }],
    now,
  });
  assert("dia encerrado não gera slots", closedSlots.length === 0);

  const partial = generateDaySlots({
    date,
    timeZone,
    durationMinutes: 30,
    workingHour,
    existing: [],
    exceptions: [{ date, startTime: "09:00", endTime: "10:00" }],
    now,
  });
  const blocked = partial.filter((slot) => slot.state === "blocked");
  const available = partial.filter((slot) => slot.state === "available");
  assert("intervalo marca slots blocked", blocked.length > 0);
  assert("resto do dia continua livre", available.length > 0);

  const start = new Date("2099-06-15T08:00:00.000Z").getTime();
  const overlaps = rangeOverlapsException(
    [{ date, startTime: "09:00", endTime: "10:00" }],
    date,
    timeZone,
    start,
    start + 30 * 60_000,
  );
  assert("overlap de excepção é boolean", typeof overlaps === "boolean");

  const freeTimes = generateTimeSlots({
    date,
    timeZone,
    durationMinutes: 30,
    workingHour,
    existing: [
      {
        startTime: new Date("2099-06-15T09:00:00+01:00"),
        endTime: new Date("2099-06-15T09:30:00+01:00"),
        status: AppointmentStatus.CONFIRMED,
      },
    ],
    now,
  });
  assert("horário ocupado não sai em generateTimeSlots", !freeTimes.includes("09:00"));
}

function testSourceGuards() {
  console.log("\nContrato do código");
  const appointments = readFileSync(new URL("../actions/appointments.ts", import.meta.url), "utf8");
  assert(
    "cancelUpcomingByPhone já não é action pública",
    !appointments.includes("export async function cancelUpcomingByPhone("),
  );
  assert("grava cancelTokenHash", appointments.includes("cancelTokenHash"));
  assert("marcações públicas podem pedir sinal", appointments.includes("applyDeposit"));
  assert("marcações com sinal ficam PENDING", appointments.includes("depositRequired"));
  const webhook = readFileSync(new URL("../app/api/webhooks/evolution/route.ts", import.meta.url), "utf8");
  assert("webhook não aceita EVOLUTION_API_KEY", !webhook.includes("EVOLUTION_API_KEY"));
  assert("webhook usa secret dedicado", webhook.includes("evolutionWebhookSecret"));
  assert("webhook não aceita ?secret=", !webhook.includes('get("secret")'));
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert("README não publica a password demo", !readme.includes("demo1234"));
}

async function main() {
  console.log("Testes funcionais (sem migrar a BD de produção)");
  await testSession();
  await testChallenge();
  testTokens();
  testSecrets();
  testWebhookParse();
  testBusinessAlertRouting();
  testDeposit();
  testBookingSchema();
  testAvailability();
  testSourceGuards();
  console.log(`\n${passed} ok, ${failed} falhas`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
