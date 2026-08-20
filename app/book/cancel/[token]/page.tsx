import { formatInTimeZone } from "date-fns-tz";
import { pt } from "date-fns/locale";
import { AppointmentStatus } from "@prisma/client";
import { getPublicAppointmentByToken } from "@/actions/appointments";
import { CancelBookingForm } from "@/components/cancel-booking-form";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function CancelBookingPage({ params }: PageProps) {
  const { token } = await params;
  const appointment = await getPublicAppointmentByToken(token);

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top,oklch(0.93_0.04_85),transparent_45%)]">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">MarcaJá</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">Cancelar marcação</h1>
        {!appointment ? (
          <Card className="mt-6">
            <CardContent className="py-8 text-sm text-muted-foreground">
              Este link não é válido. Peça um novo ao estabelecimento ou ignore se já cancelou.
            </CardContent>
          </Card>
        ) : appointment.status === AppointmentStatus.CANCELLED ? (
          <Card className="mt-6">
            <CardContent className="py-8 text-sm">
              A marcação em {appointment.user.businessName} já está cancelada.
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardContent className="space-y-4 pt-6">
              <p className="font-medium">{appointment.user.businessName}</p>
              <p className="text-sm text-muted-foreground">
                {appointment.service.name}
                <br />
                {formatInTimeZone(
                  appointment.startTime,
                  appointment.user.timezone,
                  "EEEE, d 'de' MMMM 'às' HH:mm",
                  { locale: pt },
                )}
                <br />
                {appointment.clientName}
              </p>
              <CancelBookingForm
                token={token}
                disabled={appointment.status === AppointmentStatus.COMPLETED}
              />
            </CardContent>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
