import Link from "next/link";
import { addDays, format, parse } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { pt } from "date-fns/locale";
import { CalendarPlus } from "lucide-react";
import { StatusActions } from "@/components/status-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calendarDateInZone,
  DEFAULT_TIMEZONE,
  endOfZonedDay,
  startOfZonedWeek,
} from "@/lib/timezone";
import { formatCurrency, formatPhoneDisplay } from "@/lib/utils";

export default async function AppointmentsPage() {
  const user = await requireUser();
  const tz = user.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const weekStart = startOfZonedWeek(now, tz);
  const weekStartKey = calendarDateInZone(weekStart, tz);
  const weekEndKey = format(
    addDays(parse(`${weekStartKey} 12:00`, "yyyy-MM-dd HH:mm", new Date()), 6),
    "yyyy-MM-dd",
  );
  const todayKey = calendarDateInZone(now, tz);
  const weekEnd = endOfZonedDay(parse(`${weekEndKey} 12:00`, "yyyy-MM-dd HH:mm", new Date()), tz);

  const appointments = await prisma.appointment.findMany({
    where: {
      userId: user.id,
      startTime: { gte: weekStart, lte: weekEnd },
    },
    select: {
      id: true,
      clientName: true,
      clientPhone: true,
      startTime: true,
      endTime: true,
      status: true,
      notes: true,
      service: { select: { name: true, price: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const today = appointments.filter((item) => calendarDateInZone(item.startTime, tz) === todayKey);

  const days = Array.from({ length: 7 }, (_, index) => {
    const key = format(addDays(parse(`${weekStartKey} 12:00`, "yyyy-MM-dd HH:mm", new Date()), index), "yyyy-MM-dd");
    return {
      key,
      items: appointments.filter((item) => calendarDateInZone(item.startTime, tz) === key),
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Marcações</h1>
          <p className="text-sm text-muted-foreground">Vista do dia e da semana corrente.</p>
        </div>
        <Button className="w-full sm:w-auto" asChild>
          <Link href="/appointments/new">
            <CalendarPlus className="h-4 w-4" />
            Nova marcação
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="day">Hoje ({today.length})</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
        </TabsList>
        <TabsContent value="day">
          <AppointmentList items={today} empty="Sem marcações para hoje." timeZone={tz} />
        </TabsContent>
        <TabsContent value="week" className="space-y-6">
          {days.map(({ key, items }) => (
            <section key={key}>
              <h2 className="mb-2 font-medium capitalize">
                {format(parse(`${key} 12:00`, "yyyy-MM-dd HH:mm", new Date()), "EEEE, d MMM", { locale: pt })}
              </h2>
              <AppointmentList items={items} empty="Sem marcações." timeZone={tz} />
            </section>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentList({
  items,
  empty,
  timeZone,
}: {
  items: Array<{
    id: string;
    clientName: string;
    clientPhone: string;
    startTime: Date;
    endTime: Date;
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
    notes: string | null;
    service: { name: string; price: { toString(): string } };
  }>;
  empty: string;
  timeZone: string;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">{empty}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((appointment) => (
        <Card key={appointment.id}>
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">
                {formatInTimeZone(appointment.startTime, timeZone, "HH:mm")}–
                {formatInTimeZone(appointment.endTime, timeZone, "HH:mm")} · {appointment.clientName}
              </p>
              <p className="text-sm text-muted-foreground">
                {appointment.service.name} · {formatCurrency(appointment.service.price.toString())} ·{" "}
                {formatPhoneDisplay(appointment.clientPhone)}
              </p>
              {appointment.notes ? (
                <p className="mt-1 text-sm text-muted-foreground">{appointment.notes}</p>
              ) : null}
            </div>
            <StatusActions appointmentId={appointment.id} status={appointment.status} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
