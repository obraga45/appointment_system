"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAccount, updateProfile, updateWorkingHours } from "@/actions/settings";
import { CopyPublicLink } from "@/components/copy-public-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAY_LABELS } from "@/lib/availability";
import { COMMON_TIMEZONES } from "@/lib/timezone";

type HourRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  isClosed: boolean;
};

export function SettingsForms({
  profile,
  hours,
  publicUrl,
}: {
  profile: {
    name: string;
    businessName: string;
    phone: string | null;
    timezone: string;
    slug: string;
  };
  hours: HourRow[];
  publicUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateProfile({
        name: String(form.get("name") ?? ""),
        businessName: String(form.get("businessName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        timezone: String(form.get("timezone") ?? "Europe/Lisbon"),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Perfil guardado");
      router.refresh();
    });
  }

  function onHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextHours = WEEKDAY_LABELS.map((_, dayOfWeek) => ({
      dayOfWeek,
      startTime: String(form.get(`start-${dayOfWeek}`) ?? "09:00"),
      endTime: String(form.get(`end-${dayOfWeek}`) ?? "18:00"),
      breakStart: String(form.get(`break-start-${dayOfWeek}`) ?? ""),
      breakEnd: String(form.get(`break-end-${dayOfWeek}`) ?? ""),
      isClosed: form.get(`closed-${dayOfWeek}`) === "on",
    }));

    startTransition(async () => {
      const result = await updateWorkingHours({ hours: nextHours });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Horário de funcionamento atualizado");
      router.refresh();
    });
  }

  const orderedHours = WEEKDAY_LABELS.map((_, dayOfWeek) => {
    return (
      hours.find((hour) => hour.dayOfWeek === dayOfWeek) ?? {
        dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
        breakStart: null,
        breakEnd: null,
        isClosed: dayOfWeek === 0,
      }
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Link do cliente</CardTitle>
          <CardDescription>
            Cada espaço tem um endereço do tipo temvagas.pt/agendar/o-teu-salao. O cliente vê os dias ocupados e escolhe um horário livre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyPublicLink url={publicUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perfil do negócio</CardTitle>
          <CardDescription>
            O telemóvel recebe um aviso quando entra uma marcação nova (WhatsApp ou SMS).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onProfile} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={profile.name} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="businessName">Nome do negócio</Label>
              <Input id="businessName" name="businessName" defaultValue={profile.businessName} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telemóvel para avisos</Label>
              <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} placeholder="+351 9xx xxx xxx" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">Fuso horário</Label>
              <select
                id="timezone"
                name="timezone"
                defaultValue={profile.timezone}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base md:h-10 md:text-sm"
              >
                {COMMON_TIMEZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
                {COMMON_TIMEZONES.some((zone) => zone.value === profile.timezone) ? null : (
                  <option value={profile.timezone}>{profile.timezone}</option>
                )}
              </select>
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              Guardar perfil
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horário de funcionamento</CardTitle>
          <CardDescription>
            Este é o horário semanal. Para fechar um dia ou um intervalo por imprevisto, use
            Encerramentos pontuais, mais abaixo. Preencha a pausa (almoço ou descanso) para bloquear
            esses intervalos; deixe em branco se não houver pausa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onHours} className="space-y-3">
            {orderedHours.map((hour) => (
              <div key={hour.dayOfWeek} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{WEEKDAY_LABELS[hour.dayOfWeek]}</p>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name={`closed-${hour.dayOfWeek}`} defaultChecked={hour.isClosed} />
                    Encerrado
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`start-${hour.dayOfWeek}`}>Abre</Label>
                    <Input
                      id={`start-${hour.dayOfWeek}`}
                      type="time"
                      name={`start-${hour.dayOfWeek}`}
                      defaultValue={hour.startTime}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`end-${hour.dayOfWeek}`}>Fecha</Label>
                    <Input
                      id={`end-${hour.dayOfWeek}`}
                      type="time"
                      name={`end-${hour.dayOfWeek}`}
                      defaultValue={hour.endTime}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`break-start-${hour.dayOfWeek}`}>Pausa (início)</Label>
                    <Input
                      id={`break-start-${hour.dayOfWeek}`}
                      type="time"
                      name={`break-start-${hour.dayOfWeek}`}
                      defaultValue={hour.breakStart ?? ""}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`break-end-${hour.dayOfWeek}`}>Pausa (fim)</Label>
                    <Input
                      id={`break-end-${hour.dayOfWeek}`}
                      type="time"
                      name={`break-end-${hour.dayOfWeek}`}
                      defaultValue={hour.breakEnd ?? ""}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              Guardar horários
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Eliminar conta</CardTitle>
          <CardDescription>
            Apaga o negócio, marcações, serviços e o WhatsApp ligado. Esta acção não pode ser
            desfeita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const confirmation = String(new FormData(form).get("confirmName") ?? "");
              startTransition(async () => {
                const result = await deleteAccount(confirmation);
                if (result && !result.success) {
                  toast.error(result.error);
                }
              });
            }}
            className="grid gap-3"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="confirmName">Escreva o nome do negócio ({profile.businessName})</Label>
              <Input id="confirmName" name="confirmName" autoComplete="off" required />
            </div>
            <Button type="submit" variant="destructive" className="w-full sm:w-auto" disabled={pending}>
              Eliminar conta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
