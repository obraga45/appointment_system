import { readEnv } from "@/lib/config";
import { normalizePhone } from "@/lib/utils";

export type EvolutionState = "open" | "connecting" | "close" | "unknown";

export type EvolutionConnection = {
  configured: boolean;
  state: EvolutionState;
  qr: string | null;
  pairingCode: string | null;
};

export function isEvolutionApiReady(): boolean {
  return Boolean(readEnv("EVOLUTION_API_URL") && readEnv("EVOLUTION_API_KEY"));
}

export function evolutionInstanceName(slug: string): string {
  const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 50) || "negocio";
}

function baseUrl() {
  return readEnv("EVOLUTION_API_URL").replace(/\/$/, "");
}

function apiKey() {
  return readEnv("EVOLUTION_API_KEY");
}

async function evoFetch(
  path: string,
  init?: RequestInit,
  timeoutMs = 3500,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
      headers: {
        apikey: apiKey(),
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 400) };
    }

    return { ok: response.ok, status: response.status, json };
  } catch {
    return { ok: false, status: 0, json: { error: "timeout" } };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function extractQrBase64(payload: unknown): string | null {
  const root = asRecord(payload);
  const qrcode = asRecord(root.qrcode);
  const raw =
    (typeof qrcode.base64 === "string" && qrcode.base64) ||
    (typeof root.base64 === "string" && root.base64) ||
    (typeof root.qrcode === "string" && root.qrcode) ||
    "";

  if (!raw) {
    return null;
  }

  return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
}

function pairingCandidatesFrom(record: Record<string, unknown>): unknown[] {
  const qrcode = asRecord(record.qrcode);
  const data = asRecord(record.data);
  const dataQr = asRecord(data.qrcode);
  return [record.pairingCode, record.pairing_code, qrcode.pairingCode, data.pairingCode, dataQr.pairingCode];
}

export function extractPairingCode(payload: unknown): string | null {
  const items = Array.isArray(payload) ? payload : [payload];
  for (const item of items) {
    const root = asRecord(item);
    for (const candidate of pairingCandidatesFrom(root)) {
      if (typeof candidate !== "string") {
        continue;
      }
      const compact = candidate.replace(/[\s-]/g, "").toUpperCase();
      if (compact.length >= 6 && compact.length <= 12) {
        return compact;
      }
    }
  }
  return null;
}

export function formatPairingCode(code: string): string {
  const compact = code.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return compact;
}

export function parseEvolutionState(payload: unknown): EvolutionState {
  const root = asRecord(payload);
  const instance = asRecord(root.instance);
  const value = String(instance.state ?? root.state ?? root.connectionStatus ?? "").toLowerCase();

  if (value === "open") {
    return "open";
  }
  if (value === "connecting") {
    return "connecting";
  }
  if (value === "close" || value === "closed") {
    return "close";
  }
  return "unknown";
}

function jidToPhone(value: string): string | null {
  const user = value.split("@")[0] ?? "";
  const digits = (user.split(":")[0] ?? "").replace(/\D/g, "");
  if (digits.length < 9) {
    return null;
  }
  return normalizePhone(digits);
}

function instanceNameOf(record: Record<string, unknown>): string {
  const nested = asRecord(record.instance);
  return String(record.instanceName ?? record.name ?? nested.instanceName ?? nested.name ?? "").trim();
}

export function extractEvolutionOwnerPhone(payload: unknown, instance?: string): string | null {
  const wanted = (instance ?? "").trim().toLowerCase();
  const items = Array.isArray(payload) ? payload : [payload];

  for (const item of items) {
    const rec = asRecord(item);
    const nested = asRecord(rec.instance);
    if (wanted) {
      const name = instanceNameOf(rec).toLowerCase();
      if (name !== wanted) {
        continue;
      }
    }

    const candidates = [
      rec.ownerJid,
      rec.owner,
      rec.wuid,
      rec.wid,
      nested.ownerJid,
      nested.owner,
      nested.wuid,
      nested.wid,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const phone = jidToPhone(candidate);
        if (phone) {
          return phone;
        }
      }
    }
  }

  return null;
}

export async function getEvolutionOwnerNumber(instance: string): Promise<string | null> {
  if (!isEvolutionApiReady() || !instance) {
    return null;
  }

  const named = await evoFetch(`/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
  const fromNamed = extractEvolutionOwnerPhone(named.json, instance);
  if (fromNamed) {
    return fromNamed;
  }

  const all = await evoFetch("/instance/fetchInstances");
  return extractEvolutionOwnerPhone(all.json, instance);
}

export async function getEvolutionState(instance: string): Promise<EvolutionState> {
  if (!isEvolutionApiReady()) {
    return "unknown";
  }

  const result = await evoFetch(`/instance/connectionState/${instance}`);
  if (!result.ok) {
    return result.status === 404 ? "close" : "unknown";
  }
  return parseEvolutionState(result.json);
}

export async function fetchEvolutionQr(instance: string): Promise<string | null> {
  if (!isEvolutionApiReady()) {
    return null;
  }

  const result = await evoFetch(`/instance/connect/${instance}`, undefined, 12_000);
  return extractQrBase64(result.json);
}

function payloadKeys(payload: unknown): string[] {
  const root = asRecord(payload);
  return Object.keys(root).slice(0, 12);
}

async function ensureEvolutionInstanceExists(instance: string): Promise<void> {
  await evoFetch(
    "/instance/create",
    {
      method: "POST",
      body: JSON.stringify({
        instanceName: instance,
        qrcode: false,
        integration: "WHATSAPP-BAILEYS",
      }),
    },
    12_000,
  );
}

export async function fetchEvolutionPairing(
  instance: string,
  phone: string,
): Promise<{ pairingCode: string | null; qr: string | null; timedOut: boolean; status: number }> {
  if (!isEvolutionApiReady()) {
    return { pairingCode: null, qr: null, timedOut: false, status: 0 };
  }

  const number = normalizePhone(phone);
  const created = await evoFetch(
    "/instance/create",
    {
      method: "POST",
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        number,
        integration: "WHATSAPP-BAILEYS",
      }),
    },
    15_000,
  );
  let pairingCode = extractPairingCode(created.json);
  let result = created;

  if (!pairingCode) {
    await ensureEvolutionInstanceExists(instance);
    const state = await getEvolutionState(instance);
    if (state === "connecting") {
      await logoutEvolutionInstance(instance);
    }
    result = await evoFetch(
      `/instance/connect/${instance}?number=${encodeURIComponent(number)}`,
      undefined,
      15_000,
    );
    pairingCode = extractPairingCode(result.json);
  }

  if (!pairingCode) {
    const timedOut = result.status === 0 && asRecord(result.json).error === "timeout";
    console.warn("[whatsapp] Evolution não devolveu pairingCode", {
      status: result.status,
      timedOut,
      keys: payloadKeys(result.json),
    });
    return {
      pairingCode: null,
      qr: extractQrBase64(result.json),
      timedOut,
      status: result.status,
    };
  }

  return {
    pairingCode,
    qr: extractQrBase64(result.json),
    timedOut: false,
    status: result.status,
  };
}

export async function ensureEvolutionInstance(instance: string): Promise<string | null> {
  if (!isEvolutionApiReady()) {
    throw new Error("WhatsApp ainda não está disponível");
  }

  const created = await evoFetch(
    "/instance/create",
    {
      method: "POST",
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    },
    12_000,
  );

  if (created.ok) {
    return extractQrBase64(created.json);
  }

  return fetchEvolutionQr(instance);
}

export async function logoutEvolutionInstance(instance: string): Promise<void> {
  if (!isEvolutionApiReady()) {
    return;
  }

  const result = await evoFetch(`/instance/logout/${instance}`, { method: "DELETE" });
  if (!result.ok) {
    await evoFetch(`/instance/logout/${instance}`, { method: "PUT" });
  }
}

export async function getEvolutionConnection(
  instance: string,
  options?: { includeQr?: boolean },
): Promise<EvolutionConnection> {
  if (!isEvolutionApiReady()) {
    return { configured: false, state: "unknown", qr: null, pairingCode: null };
  }

  const state = await getEvolutionState(instance);
  const qr =
    options?.includeQr && state !== "open" ? await fetchEvolutionQr(instance) : null;

  return {
    configured: true,
    state: qr && state === "close" ? "connecting" : state,
    qr,
    pairingCode: null,
  };
}
