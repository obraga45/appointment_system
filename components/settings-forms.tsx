"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateProfile, updateWorkingHours } from "@/actions/settings";
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
    evolutionInstance: string | null;
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
        evolutionInstance: String(form.get("evolutionInstance") ?? ""),
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
            Cada espaço tem um endereço próprio. O cliente vê os dias ocupados e escolhe um horário livre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyPublicLink url={publicUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perfil do negócio</CardTitle>
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
              <Label htmlFor="phone">Telemóvel</Label>
              <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
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
            <div className="grid gap-2">
              <Label htmlFor="evolutionInstance">Instância WhatsApp (Evolution)</Label>
              <Input
                id="evolutionInstance"
                name="evolutionInstance"
                defaultValue={profile.evolutionInstance ?? ""}
                placeholder="Deixe vazio para usar a instância global"
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Cada estabelecimento pode ter a sua instância na Evolution API.
              </p>
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
          <CardDescription>Os clientes só veem horários dentro destes intervalos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onHours} className="space-y-3">
            {orderedHours.map((hour) => (
              <div key={hour.dayOfWeek} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-2 md:grid-cols-[8rem_1fr_1fr_auto]">
                <p className="text-sm font-medium sm:col-span-2 md:col-span-1">{WEEKDAY_LABELS[hour.dayOfWeek]}</p>
                <Input type="time" name={`start-${hour.dayOfWeek}`} defaultValue={hour.startTime} />
                <Input type="time" name={`end-${hour.dayOfWeek}`} defaultValue={hour.endTime} />
                <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2 md:col-span-1">
                  <input type="checkbox" name={`closed-${hour.dayOfWeek}`} defaultChecked={hour.isClosed} />
                  Encerrado
                </label>
              </div>
            ))}
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              Guardar horários
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
