"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import {
  createPublicAppointment,
  getAvailabilityOverview,
  getDaySlots,
} from "@/actions/appointments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  combineDateAndTime,
  WEEKDAY_SHORT,
  type DayAvailability,
  type TimeSlot,
} from "@/lib/availability";
import { cn, formatCurrency } from "@/lib/utils";

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  description: string | null;
};

type Step = "service" | "slot" | "details" | "done";

export function BookingWizard({
  businessSlug,
  userId,
  businessName,
  services,
}: {
  businessSlug: string;
  userId: string;
  businessName: string;
  services: ServiceOption[];
}) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [closed, setClosed] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [pending, startTransition] = useTransition();

  const service = useMemo(
    () => services.find((item) => item.id === serviceId),
    [serviceId, services],
  );

  const calendarCells = useMemo(() => {
    if (days.length === 0) {
      return [];
    }
    const first = new Date(`${days[0].date}T12:00:00`);
    const leading = (first.getDay() + 6) % 7;
    const trailing = (7 - ((leading + days.length) % 7)) % 7;
    return [
      ...Array.from({ length: leading }, () => null),
      ...days,
      ...Array.from({ length: trailing }, () => null),
    ];
  }, [days]);

  useEffect(() => {
    if (step !== "slot" || !serviceId) {
      return;
    }

    let cancelled = false;
    setLoadingCalendar(true);
    getAvailabilityOverview({ userId, serviceId, days: 14 })
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setDays(result.data.days);
        const firstOpen = result.data.days.find((day) => day.status === "available");
        setDate((current) => {
          if (current && result.data.days.some((day) => day.date === current)) {
            return current;
          }
          return firstOpen?.date ?? result.data.days[0]?.date ?? "";
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingCalendar(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, userId, serviceId]);

  useEffect(() => {
    if (step !== "slot" || !serviceId || !date) {
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    getDaySlots({ userId, serviceId, date })
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setSlots([]);
          toast.error(result.error);
          return;
        }
        setClosed(result.data.closed);
        setSlots(result.data.slots);
        setTime("");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, userId, serviceId, date]);

  const availableSlots = slots.filter((slot) => slot.state === "available");
  const occupiedSlots = slots.filter((slot) => slot.state === "occupied");

  function confirm() {
    if (!service || !time) {
      toast.error("Escolha um horário livre");
      return;
    }

    startTransition(async () => {
      const result = await createPublicAppointment(businessSlug, {
        serviceId,
        clientName,
        clientPhone,
        clientEmail,
        date,
        time,
        companyWebsite: honeypot,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setStep("done");
    });
  }

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Este negócio ainda não tem serviços disponíveis.
        </CardContent>
      </Card>
    );
  }

  if (step === "done" && service) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p className="font-serif text-2xl">Marcação confirmada</p>
          <p className="text-muted-foreground">
            {service.name} em {format(combineDateAndTime(date, time), "d 'de' MMMM 'às' HH:mm", { locale: pt })}.
          </p>
          <p className="text-sm text-muted-foreground">
            Enviámos uma confirmação para o seu telemóvel, se o envio de mensagens estiver ativo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-3 gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:flex sm:gap-2 sm:text-xs">
        {["Serviço", "Horário", "Dados"].map((label, index) => {
          const current = ["service", "slot", "details"].indexOf(step);
          return (
            <li
              key={label}
              className={`rounded-full px-2 py-1 text-center sm:px-3 ${index <= current ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              <span>
                {index + 1}. {label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === "service" ? (
        <div className="grid gap-3">
          {services.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setServiceId(item.id);
                setDate("");
                setTime("");
                setDays([]);
                setSlots([]);
                setStep("slot");
              }}
              className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
                <p className="text-sm font-medium">{formatCurrency(item.price)}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.durationMinutes} minutos</p>
            </button>
          ))}
        </div>
      ) : null}

      {step === "slot" ? (
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div>
              <p className="font-medium">
                {service?.name} · {service?.durationMinutes} min
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Os dias e horários a cinzento já estão ocupados. Escolha uma data livre.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <LegendDot className="bg-primary" label="Com horários livres" />
              <LegendDot className="bg-rose-300" label="Dia completo" />
              <LegendDot className="bg-muted-foreground/30" label="Encerrado" />
            </div>

            {loadingCalendar ? (
              <p className="text-sm text-muted-foreground">A carregar o calendário…</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground sm:text-xs">
                  {WEEKDAY_SHORT.map((label) => (
                    <span key={label}>
                      <span className="sm:hidden">{label.slice(0, 1)}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((day, index) => {
                    if (!day) {
                      return <span key={`empty-${index}`} />;
                    }
                    const selected = date === day.date;
                    const disabled = day.status === "closed";
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDate(day.date)}
                        title={dayLabel(day)}
                        className={cn(
                          "flex min-h-11 flex-col items-center justify-center rounded-lg border text-xs transition sm:aspect-square sm:rounded-xl sm:text-sm",
                          selected && "border-primary bg-primary text-primary-foreground",
                          !selected && day.status === "available" && "border-primary/30 bg-card hover:border-primary",
                          !selected && day.status === "full" && "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400",
                          !selected && day.status === "closed" && "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50",
                        )}
                      >
                        <span>{Number(day.date.slice(8))}</span>
                        {day.status === "available" ? (
                          <span className={cn("hidden text-[10px] sm:block", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            {day.availableCount} livres
                          </span>
                        ) : null}
                        {day.status === "full" ? (
                          <span className="hidden text-[10px] sm:block">ocupado</span>
                        ) : null}
                        {day.status === "available" ? (
                          <span className={cn("mt-0.5 h-1 w-1 rounded-full sm:hidden", selected ? "bg-primary-foreground" : "bg-primary")} />
                        ) : null}
                        {day.status === "full" ? (
                          <span className="mt-0.5 h-1 w-1 rounded-full bg-rose-400 sm:hidden" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">
                {date
                  ? format(new Date(`${date}T00:00:00`), "EEEE, d 'de' MMMM", { locale: pt })
                  : "Escolha um dia"}
              </p>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">A carregar horários…</p>
              ) : closed ? (
                <p className="text-sm text-muted-foreground">Encerrado neste dia. Escolha outra data.</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem horários neste dia.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                    {slots.map((slot) => {
                      const available = slot.state === "available";
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            if (!available) return;
                            setTime(slot.time);
                            setStep("details");
                          }}
                          className={cn(
                            "min-h-11 rounded-lg border px-2 py-2 text-xs sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm",
                            available && "hover:border-primary",
                            !available && "cursor-not-allowed border-dashed bg-muted text-muted-foreground line-through",
                            slot.state === "occupied" && "bg-rose-50 text-rose-700/80",
                          )}
                        >
                          <span className="block">{slot.time}</span>
                          {slot.state === "occupied" ? (
                            <span className="hidden font-normal no-underline sm:inline"> ocupado</span>
                          ) : null}
                          {slot.state === "past" ? (
                            <span className="hidden font-normal no-underline sm:inline"> passou</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {occupiedSlots.length > 0 && availableSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este dia está completo. Escolha no calendário uma data com horários livres.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep("service")}>
              Voltar aos serviços
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "details" ? (
        <Card>
          <CardContent className="relative space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              {service?.name} · {format(combineDateAndTime(date, time), "EEEE, d MMM 'às' HH:mm", { locale: pt })}
            </p>
            <div className="grid gap-2">
              <Label htmlFor="clientName">Nome</Label>
              <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clientPhone">Telemóvel</Label>
              <Input
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="9xx xxx xxx"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clientEmail">Email (opcional)</Label>
              <Input id="clientEmail" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            </div>
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <Label htmlFor="companyWebsite">Website</Label>
              <Input
                id="companyWebsite"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setStep("slot")}>
                Voltar
              </Button>
              <Button className="w-full sm:w-auto" onClick={confirm} disabled={pending || !clientName || !clientPhone}>
                {pending ? "A confirmar…" : `Confirmar em ${businessName}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function dayLabel(day: DayAvailability) {
  if (day.status === "closed") return "Encerrado";
  if (day.status === "full") return "Dia completo — todos os horários ocupados";
  return `${day.availableCount} horários livres`;
}
