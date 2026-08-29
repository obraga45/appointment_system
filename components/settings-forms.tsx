"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteAccount, updateDepositSettings, updateProfile, updateWorkingHours } from "@/actions/settings";
import { DEPOSIT_HOLD_MINUTES } from "@/lib/deposit";
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

function toHourRows(hours: HourRow[]): HourRow[] {
  return WEEKDAY_LABELS.map((_, dayOfWeek) => {
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
}

export function SettingsForms({
  profile,
  hours,
  publicUrl,
  deposit,
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
  deposit: {
    enabled: boolean;
    amount: string;
    mbWay: string;
    iban: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hourRows, setHourRows] = useState(() => toHourRows(hours));
  const [depositEnabled, setDepositEnabled] = useState(deposit.enabled);

  useEffect(() => {
    setDepositEnabled(deposit.enabled);
  }, [deposit.enabled]);

  useEffect(() => {
    setHourRows(toHourRows(hours));
  }, [hours]);

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

  function patchHour(dayOfWeek: number, patch: Partial<HourRow>) {
    setHourRows((rows) => rows.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)));
  }

  function copyMondayToWeekdays() {
    const monday = hourRows.find((row) => row.dayOfWeek === 1);
    if (!monday) {
      return;
    }
    setHourRows((rows) =>
      rows.map((row) =>
        row.dayOfWeek >= 2 && row.dayOfWeek <= 5
          ? {
              ...row,
              startTime: monday.startTime,
              endTime: monday.endTime,
              breakStart: monday.breakStart,
              breakEnd: monday.breakEnd,
              isClosed: monday.isClosed,
            }
          : row,
      ),
    );
    toast.success("Horário de segunda copiado para terça a sexta");
  }

  function onDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateDepositSettings({
        enabled: depositEnabled,
        amount: Number(form.get("depositAmount") ?? 0),
        mbWay: String(form.get("depositMbWay") ?? ""),
        iban: String(form.get("depositIban") ?? ""),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(depositEnabled ? "Sinal de confirmação guardado" : "Sinal desligado");
      router.refresh();
    });
  }

  function onHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateWorkingHours({
        hours: hourRows.map((row) => ({
          ...row,
          breakStart: row.breakStart ?? "",
          breakEnd: row.breakEnd ?? "",
        })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Horário de funcionamento atualizado");
      router.refresh();
    });
  }

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
            Este número recebe um WhatsApp da TemVagas quando entra uma marcação nova — nome do
            cliente, telemóvel, serviço e horário. Pode ser o mesmo telemóvel ligado ao QR.
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
          <CardTitle>Sinal para confirmar</CardTitle>
          <CardDescription>
            Opcional. O cliente envia o valor por MB Way ou transferência para o teu espaço — o
            dinheiro não passa pela TemVagas. O horário fica reservado {DEPOSIT_HOLD_MINUTES} minutos
            até confirmares no painel. O sinal desconta-se no serviço.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onDeposit} className="grid gap-4">
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={depositEnabled}
                onChange={(event) => setDepositEnabled(event.target.checked)}
              />
              <span>
                <span className="font-medium">Pedir sinal para confirmar a marcação</span>
                <span className="mt-1 block text-muted-foreground">
                  Sem isto, as marcações no link ficam confirmadas na hora.
                </span>
              </span>
            </label>
            <div className="grid gap-2">
              <Label htmlFor="depositAmount">Valor do sinal (€)</Label>
              <Input
                id="depositAmount"
                name="depositAmount"
                type="number"
                min="1"
                max="200"
                step="0.50"
                defaultValue={deposit.amount || "5"}
                disabled={!depositEnabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="depositMbWay">MB Way do espaço</Label>
              <Input
                id="depositMbWay"
                name="depositMbWay"
                defaultValue={deposit.mbWay || profile.phone || ""}
                placeholder="+351 9xx xxx xxx"
                disabled={!depositEnabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="depositIban">IBAN (opcional)</Label>
              <Input
                id="depositIban"
                name="depositIban"
                defaultValue={deposit.iban}
                placeholder="PT50 0000 0000 0000 0000 0000 0"
                disabled={!depositEnabled}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
              Guardar sinal
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
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={copyMondayToWeekdays}>
              Copiar segunda para terça a sexta
            </Button>
            {hourRows.map((hour) => (
              <div key={hour.dayOfWeek} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{WEEKDAY_LABELS[hour.dayOfWeek]}</p>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hour.isClosed}
                      onChange={(event) => patchHour(hour.dayOfWeek, { isClosed: event.target.checked })}
                    />
                    Encerrado
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`start-${hour.dayOfWeek}`}>Abre</Label>
                    <Input
                      id={`start-${hour.dayOfWeek}`}
                      type="time"
                      value={hour.startTime}
                      onChange={(event) => patchHour(hour.dayOfWeek, { startTime: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`end-${hour.dayOfWeek}`}>Fecha</Label>
                    <Input
                      id={`end-${hour.dayOfWeek}`}
                      type="time"
                      value={hour.endTime}
                      onChange={(event) => patchHour(hour.dayOfWeek, { endTime: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`break-start-${hour.dayOfWeek}`}>Pausa (início)</Label>
                    <Input
                      id={`break-start-${hour.dayOfWeek}`}
                      type="time"
                      value={hour.breakStart ?? ""}
                      onChange={(event) => patchHour(hour.dayOfWeek, { breakStart: event.target.value || null })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`break-end-${hour.dayOfWeek}`}>Pausa (fim)</Label>
                    <Input
                      id={`break-end-${hour.dayOfWeek}`}
                      type="time"
                      value={hour.breakEnd ?? ""}
                      onChange={(event) => patchHour(hour.dayOfWeek, { breakEnd: event.target.value || null })}
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
    </div>
  );
}

export function DeleteAccountCard({ businessName }: { businessName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Zona de perigo</CardTitle>
        <CardDescription>
          Apaga o negócio, marcações, serviços e o WhatsApp ligado. Esta acção não pode ser desfeita.
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
            <Label htmlFor="confirmName">Escreva o nome do negócio ({businessName})</Label>
            <Input id="confirmName" name="confirmName" autoComplete="off" required />
          </div>
          <Button type="submit" variant="destructive" className="w-full sm:w-auto" disabled={pending}>
            Eliminar conta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
