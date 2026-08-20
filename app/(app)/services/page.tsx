import { ServicesManager } from "@/components/services-manager";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ServicesPage() {
  const user = await requireUser();
  const services = await prisma.service.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">Serviços</h1>
        <p className="text-sm text-muted-foreground">
          Defina o que os clientes podem marcar no link público.
        </p>
      </div>
      <ServicesManager
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: service.price.toString(),
          description: service.description,
          isActive: service.isActive,
        }))}
      />
    </div>
  );
}
