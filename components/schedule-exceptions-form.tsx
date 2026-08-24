"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { format, parse } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import { createScheduleException, deleteScheduleException } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ScheduleExceptionRow = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

function formatDate(date: string) {
  return format(parse(`${date} 12:00`, "yyyy-MM-dd HH:mm", new Date()), "EEEE, d 'de' MMMM", {
    locale: pt,
  });
}

export function ScheduleExceptionsForm({
  exceptions,
  minDate,
}: {
  exceptions: ScheduleExceptionRow[];
  minDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [wholeDay, setWholeDay] = useState(true);

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createScheduleException({
        date: String(data.get("date") ?? ""),
        startTime: wholeDay ? "" : String(data.get("startTime") ?? ""),
        endTime: wholeDay ? "" : String(data.get("endTime") ?? ""),
        note: String(data.get("note") ?? ""),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Horário encerrado para novas marcações");
      form.reset();
      setWholeDay(true);
      router.refresh();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteScheduleException(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Encerramento removido");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Encerramentos pontuais</CardTitle>
        <CardDescription>
          Feche um dia ou um intervalo por imprevisto. O horário semanal não muda. Marcações já
          feitas mantêm-se; novas ficam bloqueadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={onCreate} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="exception-date">Data</Label>
              <Input id="exception-date" name="date" type="date" min={minDate} required />
            </div>
            <label className="flex min-h-11 items-end gap-2 text-sm sm:pb-2">
              <input
                type="checkbox"
                checked={wholeDay}
                onChange={(event) => setWholeDay(event.target.checked)}
              />
              Dia inteiro
            </label>
          </div>
          {wholeDay ? null : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="exception-start">Das</Label>
                <Input id="exception-start" name="startTime" type="time" required={!wholeDay} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exception-end">Até</Label>
                <Input id="exception-end" name="endTime" type="time" required={!wholeDay} />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="exception-note">Motivo (opcional)</Label>
            <Input id="exception-note" name="note" maxLength={120} placeholder="Ex.: consulta, avaria, feriado" />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
            Encerrar
          </Button>
        </form>

        {exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há encerramentos pontuais à frente.</p>
        ) : (
          <ul className="space-y-2">
            {exceptions.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium capitalize">{formatDate(item.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.startTime && item.endTime
                      ? `${item.startTime} – ${item.endTime}`
                      : "Dia inteiro"}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={pending}
                  onClick={() => onDelete(item.id)}
                >
                  Reabrir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
