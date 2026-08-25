"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { getWhatsAppStatus, relinkWhatsApp, startWhatsAppConnection, type WhatsAppStatus } from "@/actions/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function connectionBadge(status: WhatsAppStatus) {
  if (!status.configured) {
    return <Badge variant="muted">Indisponível</Badge>;
  }
  if (status.connected) {
    return <Badge variant="success">Conectado</Badge>;
  }
  if (status.state === "connecting" || status.qr) {
    return <Badge variant="warning">A ligar</Badge>;
  }
  return <Badge variant="destructive">Desconectado</Badge>;
}

export function WhatsAppConnectCard({ initial }: { initial?: WhatsAppStatus }) {
  const [status, setStatus] = useState<WhatsAppStatus>(
    initial ?? { configured: true, connected: false, state: "close", qr: null },
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initial) {
      return;
    }

    startTransition(async () => {
      const result = await getWhatsAppStatus();
      if (result.success) {
        setStatus(result.data);
      }
    });
  }, [initial]);

  useEffect(() => {
    if (status.connected || !status.qr) {
      return;
    }

    const timer = setInterval(async () => {
      const result = await getWhatsAppStatus();
      if (!result.success) {
        return;
      }
      setStatus((current) => ({
        ...result.data,
        qr: result.data.qr ?? current.qr,
      }));
      if (result.data.connected) {
        toast.success("WhatsApp ligado");
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [status.connected, status.qr]);

  function apply(result: Awaited<ReturnType<typeof startWhatsAppConnection>>) {
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setStatus(result.data);
    if (result.data.connected) {
      toast.success("WhatsApp já está ligado");
    }
  }

  function onConnect() {
    startTransition(async () => apply(await startWhatsAppConnection()));
  }

  function onRelink() {
    if (!window.confirm("Vai desligar o telemóvel atual e gerar um QR novo. Continuar?")) {
      return;
    }
    startTransition(async () => apply(await relinkWhatsApp()));
  }

  return (
    <Card id="whatsapp">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          WhatsApp
          {connectionBadge(status)}
        </CardTitle>
        <CardDescription>
          {!status.configured
            ? "As confirmações ainda não estão disponíveis. Tente mais tarde."
            : status.connected
              ? "As confirmações e o cancelar por mensagem saem deste telemóvel."
              : "Ligue o WhatsApp do negócio. Os clientes recebem a confirmação nesse número."}
        </CardDescription>
      </CardHeader>
      {status.configured ? (
        <CardContent className="space-y-4">
          {status.connected ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={onRelink}>
              Ligar outro telemóvel
            </Button>
          ) : status.qr ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No telemóvel: WhatsApp → Definições → Aparelhos ligados → Ligar um aparelho.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={status.qr}
                alt="QR para ligar o WhatsApp"
                className="mx-auto h-56 w-56 rounded-lg border bg-white p-2"
              />
              <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={onConnect}>
                Gerar QR outra vez
              </Button>
            </div>
          ) : (
            <Button type="button" className="w-full sm:w-auto" disabled={pending} onClick={onConnect}>
              Ligar WhatsApp
            </Button>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
