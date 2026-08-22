"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { getWhatsAppStatus, relinkWhatsApp, startWhatsAppConnection, type WhatsAppStatus } from "@/actions/whatsapp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      setStatus(result.data);
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

  if (!status.configured) {
    return (
      <Card id="whatsapp">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </CardTitle>
          <CardDescription>As confirmações ainda não estão disponíveis. Tente mais tarde.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="whatsapp">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          WhatsApp
        </CardTitle>
        <CardDescription>
          {status.connected
            ? "As confirmações e o cancelar por mensagem saem deste telemóvel."
            : "Ligue o WhatsApp do negócio. Os clientes recebem a confirmação nesse número."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.connected ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Ligado
            </p>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={onRelink}>
              Ligar outro telemóvel
            </Button>
          </div>
        ) : (
          <>
            {status.qr ? (
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
