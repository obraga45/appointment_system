import { notFound } from "next/navigation";
import { cache } from "react";
import { BookingWizard } from "@/components/booking-wizard";
import { SiteFooter } from "@/components/site-footer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ businessSlug: string }>;
};

const getPublicBusiness = cache(async (businessSlug: string) => {
  return prisma.user.findUnique({
    where: { slug: businessSlug },
    select: {
      id: true,
      slug: true,
      businessName: true,
      services: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          price: true,
          description: true,
        },
      },
    },
  });
});

export async function generateMetadata({ params }: PageProps) {
  const { businessSlug } = await params;
  const business = await getPublicBusiness(businessSlug);

  return {
    title: business ? `Marcar em ${business.businessName}` : "Agendamento",
  };
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { businessSlug } = await params;
  const business = await getPublicBusiness(businessSlug);

  if (!business) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,oklch(0.93_0.04_85),transparent_45%)]">
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:py-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary sm:text-sm">MarcaJá</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">{business.businessName}</h1>
        <p className="mt-2 text-muted-foreground">
          Veja os dias já ocupados, escolha um horário livre e deixe o seu telemóvel. Recebe confirmação automática.
        </p>
        <div className="mt-8">
          <BookingWizard
            businessSlug={business.slug}
            userId={business.id}
            businessName={business.businessName}
            services={business.services.map((service) => ({
              id: service.id,
              name: service.name,
              durationMinutes: service.durationMinutes,
              price: service.price.toString(),
              description: service.description,
            }))}
          />
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
