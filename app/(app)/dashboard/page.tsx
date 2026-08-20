import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { pt } from "date-fns/locale";
import { CalendarPlus } from "lucide-react";
import { CopyPublicLink } from "@/components/copy-public-link";
import { OnboardingCard } from "@/components/onboarding-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_VARIANT } from "@/lib/status";
import { calendarDateInZone, DEFAULT_TIMEZONE, endOfZonedDay, startOfZonedDay } from "@/lib/timezone";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const tz = user.timezone || DEFAULT_TIMEZONE;
  const today = new Date();
  const from = startOfZonedDay(today, tz);
  const to = endOfZonedDay(today, tz);
  const publicUrl = `${appUrl()}/book/${user.slug}`;

  const [appointments, services, upcoming, failedReminders] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        userId: user.id,
        startTime: { gte: from, lte: to },
      },
      include: { service: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.service.count({ where: { userId: user.id, isActive: true } }),
    prisma.appointment.count({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: today },
      },
    }),
    prisma.notificationLog.count({
      where: {
        status: "FAILED",
        appointment: {
          userId: user.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { gte: today },
        },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">
            {formatInTimeZone(today, tz, "EEEE, d 'de' MMMM", { locale: pt })}
          </p>
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Bom dia, {user.name.split(" ")[0]}</h1>
        </div>
        <Button className="w-full sm:w-auto" asChild>
          <Link href="/appointments/new">
            <CalendarPlus className="h-4 w-4" />
            Nova marcação
          </Link>
        </Button>
      </div>

      <OnboardingCard hasServices={services > 0} publicUrl={publicUrl} />

      {failedReminders > 0 ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm">
            {failedReminders} lembrete{failedReminders === 1 ? "" : "s"} falharam. Verifique a Evolution API
            em Definições.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl">{appointments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Próximas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl">{upcoming}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Serviços ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-3xl">{services}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl">Link do cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Partilhe este endereço. O cliente vê os dias e horários já ocupados e marca noutro livre.
          </p>
          <CopyPublicLink url={publicUrl} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg sm:text-xl">Agenda de hoje</h2>
          <Button variant="ghost" asChild>
            <Link href="/appointments">Ver semana</Link>
          </Button>
        </div>
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Sem marcações para hoje. Partilhe o link{" "}
              <span className="font-medium text-foreground">/book/{user.slug}</span> com os clientes.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {formatInTimeZone(appointment.startTime, tz, "HH:mm")} –{" "}
                      {formatInTimeZone(appointment.endTime, tz, "HH:mm")} · {appointment.clientName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.service.name} · {formatCurrency(appointment.service.price.toString())}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[appointment.status]}>
                    {STATUS_LABELS[appointment.status]}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
