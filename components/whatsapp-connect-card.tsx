"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import {
  getWhatsAppStatus,
  relinkWhatsApp,
  startWhatsAppConnection,
  startWhatsAppPairing,
  type WhatsAppStatus,
} from "@/actions/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/phone-input";
import { ptMobileLocalDigits } from "@/lib/utils";
function formatPairingCode(code: string) {
  const compact = code.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return compact;
}

function connectionBadge(status: WhatsAppStatus) {
  if (!status.configured) {
    return <Badge variant="muted">Indisponível</Badge>;
  }
  if (status.connected) {
    return <Badge variant="success">Conectado</Badge>;
  }
  if (status.state === "connecting" || status.qr || status.pairingCode) {
    return <Badge variant="warning">A ligar</Badge>;
  }
  return <Badge variant="destructive">Desconectado</Badge>;
}

export function WhatsAppConnectCard({
  initial,
  defaultPhone = "",
}: {
  initial?: WhatsAppStatus;
  defaultPhone?: string;
}) {
  const [status, setStatus] = useState<WhatsAppStatus>(
    initial ?? {
      configured: true,
      connected: false,
      state: "close",
      qr: null,
      pairingCode: null,
    },
  );
  const [phone, setPhone] = useState(() => ptMobileLocalDigits(defaultPhone));
  const [showQr, setShowQr] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (defaultPhone && !phone) {
      setPhone(ptMobileLocalDigits(defaultPhone));
    }
  }, [defaultPhone, phone]);

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
    if (status.connected || (!status.qr && !status.pairingCode)) {
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
        pairingCode: result.data.pairingCode ?? current.pairingCode,
      }));
      if (result.data.connected) {
        toast.success("WhatsApp ligado");
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [status.connected, status.qr, status.pairingCode]);

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

  function onPair() {
    startTransition(async () => apply(await startWhatsAppPairing(phone)));
  }

  function onShowQr() {
    setShowQr(true);
    startTransition(async () => apply(await startWhatsAppConnection()));
  }

  function onRelink() {
    if (
      !window.confirm(
        "Vai desligar o telemóvel atual. Depois podes ligar com um código neste ecrã ou com QR noutro aparelho.",
      )
    ) {
      return;
    }
    setShowQr(false);
    startTransition(async () => apply(await relinkWhatsApp()));
  }

  const pairingCode = status.pairingCode ? formatPairingCode(status.pairingCode) : null;

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
              : "Podes ligar neste telemóvel com um código. O QR serve se tiveres um computador ao lado."}
        </CardDescription>
      </CardHeader>
      {status.configured ? (
        <CardContent className="space-y-4">
          {status.connected ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={onRelink}>
              Ligar outro telemóvel
            </Button>
          ) : (
            <>
              {pairingCode ? (
                <div className="space-y-3 rounded-xl border bg-secondary/40 p-4">
                  <p className="text-sm font-medium">Neste telemóvel</p>
                  <p className="text-sm text-muted-foreground">
                    WhatsApp → Definições → Aparelhos ligados → Ligar um aparelho → Ligar com
                    número de telefone. Escreve este código (expira depressa):
                  </p>
                  <p className="font-mono text-3xl font-semibold tracking-[0.2em] sm:text-4xl">
                    {pairingCode}
                  </p>
                  <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={onPair}>
                    Gerar código outra vez
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onPair();
                  }}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="whatsappPhone">Telemóvel deste WhatsApp</Label>
                    <PhoneInput
                      id="whatsappPhone"
                      value={phone}
                      onValueChange={setPhone}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Portugal (+351). Só os 9 dígitos deste telemóvel.</p>
                  </div>
                  <Button type="submit" className="w-full sm:w-auto" disabled={pending || phone.length !== 9}>
                    {pending ? "A gerar código…" : "Ligar neste telemóvel"}
                  </Button>
                </form>
              )}

              {showQr || status.qr ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Noutro ecrã: WhatsApp → Definições → Aparelhos ligados → Ligar um aparelho, e lê
                    o QR com este telemóvel.
                  </p>
                  {status.qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={status.qr}
                      alt="QR para ligar o WhatsApp"
                      className="mx-auto h-56 w-56 rounded-lg border bg-white p-2"
                    />
                  ) : null}
                  <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={pending} onClick={onShowQr}>
                    Gerar QR outra vez
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" className="w-full sm:w-auto" disabled={pending} onClick={onShowQr}>
                  Tenho um computador — mostrar QR
                </Button>
              )}
            </>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
