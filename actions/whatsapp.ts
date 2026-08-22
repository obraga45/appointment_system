"use server";

import { requireUser } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  ensureEvolutionInstance,
  evolutionInstanceName,
  getEvolutionConnection,
  isEvolutionApiReady,
  logoutEvolutionInstance,
  type EvolutionState,
} from "@/lib/evolution";
import { prisma } from "@/lib/prisma";

export type WhatsAppStatus = {
  configured: boolean;
  connected: boolean;
  state: EvolutionState;
  qr: string | null;
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

function toStatus(connection: Awaited<ReturnType<typeof getEvolutionConnection>>): WhatsAppStatus {
  return {
    configured: connection.configured,
    connected: connection.state === "open",
    state: connection.state,
    qr: connection.qr,
  };
}

export async function getWhatsAppStatus(): Promise<ActionResult<WhatsAppStatus>> {
  try {
    if (!isEvolutionApiReady()) {
      return ok({ configured: false, connected: false, state: "unknown", qr: null });
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
      toStatus({
        ...connection,
        qr: qr ?? connection.qr,
        state: connection.state === "open" ? "open" : "connecting",
      }),
    );
  } catch (error) {
    console.error("[whatsapp] startWhatsAppConnection:", error);
    return fail("Não foi possível gerar o QR do WhatsApp");
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
    const qr = await ensureEvolutionInstance(name);
    const connection = await getEvolutionConnection(name);

    return ok(
      toStatus({
        ...connection,
        qr: qr ?? connection.qr,
        state: "connecting",
      }),
    );
  } catch (error) {
    console.error("[whatsapp] relinkWhatsApp:", error);
    return fail("Não foi possível gerar um novo QR");
  }
}
