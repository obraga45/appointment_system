import { NewAppointmentForm } from "@/components/new-appointment-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewAppointmentPage() {
  const user = await requireUser();
  const services = await prisma.service.findMany({
    where: { userId: user.id, isActive: true },
    select: { id: true, name: true, durationMinutes: true, price: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Nova marcação</h1>
        <p className="text-sm text-muted-foreground">Registo manual no painel do profissional.</p>
      </div>
      <NewAppointmentForm
        userId={user.id}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: service.price.toString(),
        }))}
      />
    </div>
  );
}
