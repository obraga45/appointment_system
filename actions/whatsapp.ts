"use server";

import { requireUser } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  ensureEvolutionInstance,
  evolutionInstanceName,
  fetchEvolutionPairing,
  getEvolutionConnection,
  isEvolutionApiReady,
  logoutEvolutionInstance,
  type EvolutionState,
} from "@/lib/evolution";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils";

export type WhatsAppStatus = {
  configured: boolean;
  connected: boolean;
  state: EvolutionState;
  qr: string | null;
  pairingCode: string | null;
};

function instanceName(user: { evolutionInstance: string | null; slug: string }) {
  return evolutionInstanceName(user.evolutionInstance || user.slug);
}

async function persistInstance(userId: string, current: string | null, name: string) {
  if (current !== name) {
    await prisma.user.update({
      where: { id: userId },
      data: { evolutionInstance: name },
    });
  }
}

function toStatus(
  connection: Awaited<ReturnType<typeof getEvolutionConnection>>,
  extra?: { qr?: string | null; pairingCode?: string | null },
): WhatsAppStatus {
  return {
    configured: connection.configured,
    connected: connection.state === "open",
    state: connection.state,
    qr: extra?.qr ?? connection.qr,
    pairingCode: extra?.pairingCode ?? connection.pairingCode,
  };
}

function emptyStatus(configured: boolean, connected = false): WhatsAppStatus {
  return {
    configured,
    connected,
    state: connected ? "open" : "close",
    qr: null,
    pairingCode: null,
  };
}

export async function getWhatsAppStatus(): Promise<ActionResult<WhatsAppStatus>> {
  try {
    if (!isEvolutionApiReady()) {
      return ok(emptyStatus(false));
    }

    const user = await requireUser();
    return ok(toStatus(await getEvolutionConnection(instanceName(user))));
  } catch (error) {
    console.error("[whatsapp] getWhatsAppStatus:", error);
    return fail("Não foi possível verificar o WhatsApp");
  }
}

export async function startWhatsAppConnection(): Promise<ActionResult<WhatsAppStatus>> {
  try {
    if (!isEvolutionApiReady()) {
      return fail("WhatsApp ainda não está disponível. Tente mais tarde.");
    }

    const user = await requireUser();
    const name = instanceName(user);
    await persistInstance(user.id, user.evolutionInstance, name);
    const qr = await ensureEvolutionInstance(name);
    const connection = await getEvolutionConnection(name);

    return ok(
      toStatus(
        {
          ...connection,
          state: connection.state === "open" ? "open" : "connecting",
        },
        { qr: qr ?? connection.qr, pairingCode: null },
      ),
    );
  } catch (error) {
    console.error("[whatsapp] startWhatsAppConnection:", error);
    return fail("Não foi possível gerar o QR do WhatsApp");
  }
}

export async function startWhatsAppPairing(rawPhone: unknown): Promise<ActionResult<WhatsAppStatus>> {
  const phone = normalizePhone(String(rawPhone ?? ""));
  if (phone.length < 9) {
    return fail("Indique o telemóvel do WhatsApp do negócio");
  }

  try {
    if (!isEvolutionApiReady()) {
      return fail("WhatsApp ainda não está disponível. Tente mais tarde.");
    }

    const user = await requireUser();
    const name = instanceName(user);
    await persistInstance(user.id, user.evolutionInstance, name);
    const pairing = await fetchEvolutionPairing(name, phone);
    const connection = await getEvolutionConnection(name);

    if (connection.state === "open") {
      return ok(toStatus({ ...connection, state: "open" }));
    }

    if (!pairing.pairingCode) {
      if (pairing.timedOut) {
        return fail("O WhatsApp demorou a responder. Tente outra vez.");
      }
      return fail("Não foi possível gerar o código. Tente outra vez ou use o QR noutro ecrã.");
    }

    return ok(
      toStatus(
        { ...connection, state: "connecting" },
        { pairingCode: pairing.pairingCode, qr: null },
      ),
    );
  } catch (error) {
    console.error("[whatsapp] startWhatsAppPairing:", error);
    return fail("Não foi possível gerar o código do WhatsApp");
  }
}

export async function relinkWhatsApp(): Promise<ActionResult<WhatsAppStatus>> {
  try {
    if (!isEvolutionApiReady()) {
      return fail("WhatsApp ainda não está disponível. Tente mais tarde.");
    }

    const user = await requireUser();
    const name = instanceName(user);
    await persistInstance(user.id, user.evolutionInstance, name);
    await logoutEvolutionInstance(name);

    return ok(emptyStatus(true));
  } catch (error) {
    console.error("[whatsapp] relinkWhatsApp:", error);
    return fail("Não foi possível desligar o WhatsApp");
  }
}
