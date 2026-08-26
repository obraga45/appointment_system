"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAppointment, getAvailableSlots } from "@/actions/appointments";
import { startPageProgress } from "@/components/navigation-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
};

export function NewAppointmentForm({
  userId,
  services,
}: {
  userId: string;
  services: ServiceOption[];
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId),
    [serviceId, services],
  );

  useEffect(() => {
    if (!serviceId || !date) {
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    getAvailableSlots({ userId, serviceId, date })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setSlots(result.data);
          setTime((current) => (result.data.includes(current) ? current : ""));
        } else {
          setSlots([]);
          toast.error(result.error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, serviceId, date]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time) {
      toast.error("Escolha um horário");
      return;
    }

    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createAppointment({
        userId,
        serviceId,
        clientName: String(form.get("clientName") ?? ""),
        clientPhone: String(form.get("clientPhone") ?? ""),
        clientEmail: String(form.get("clientEmail") ?? ""),
        notes: String(form.get("notes") ?? ""),
        date,
        time,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Marcação criada e confirmação enviada");
      startPageProgress();
      router.push("/appointments");
      router.refresh();
    });
  }

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Crie pelo menos um serviço antes de marcar.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova marcação</CardTitle>
        <CardDescription>
          O cliente recebe confirmação por WhatsApp. Use um número com WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="serviceId">Serviço</Label>
            <select
              id="serviceId"
              className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base md:h-10 md:text-sm"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.durationMinutes} min · {formatCurrency(service.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Duração</Label>
              <p className="flex h-10 items-center text-sm text-muted-foreground">
                {selectedService?.durationMinutes ?? "—"} minutos
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Horário disponível</Label>
            {loadingSlots ? (
              <p className="text-sm text-muted-foreground">A carregar horários…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem horários livres neste dia. Se fechou o dia ou um intervalo em Encerramentos
                pontuais, reabra-o nas definições para voltar a marcar.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm sm:min-h-0 sm:py-1.5 ${
                      time === slot ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="clientName">Nome do cliente</Label>
              <Input id="clientName" name="clientName" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clientPhone">Telemóvel (WhatsApp)</Label>
              <Input
                id="clientPhone"
                name="clientPhone"
                required
                placeholder="9xx xxx xxx"
                inputMode="tel"
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                A confirmação e os lembretes vão por WhatsApp para este número.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clientEmail">Email (opcional)</Label>
            <Input id="clientEmail" name="clientEmail" type="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={pending || !time}>
            {pending ? "A guardar…" : "Criar marcação"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
