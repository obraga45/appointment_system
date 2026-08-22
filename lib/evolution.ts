import { readEnv } from "@/lib/config";

export type EvolutionState = "open" | "connecting" | "close" | "unknown";

export type EvolutionConnection = {
  configured: boolean;
  state: EvolutionState;
  qr: string | null;
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

async function evoFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: unknown }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
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

  const result = await evoFetch(`/instance/connect/${instance}`);
  return extractQrBase64(result.json);
}

export async function ensureEvolutionInstance(instance: string): Promise<string | null> {
  if (!isEvolutionApiReady()) {
    throw new Error("WhatsApp ainda não está disponível");
  }

  const created = await evoFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instance,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });

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

export async function getEvolutionConnection(instance: string): Promise<EvolutionConnection> {
  if (!isEvolutionApiReady()) {
    return { configured: false, state: "unknown", qr: null };
  }

  const state = await getEvolutionState(instance);
  const qr = state === "open" ? null : await fetchEvolutionQr(instance);

  return {
    configured: true,
    state: qr && state === "close" ? "connecting" : state,
    qr,
  };
}
