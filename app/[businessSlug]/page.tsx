import { notFound } from "next/navigation";
import { PublicBookingPage, publicBookingMetadata } from "@/components/public-booking-page";
import { isReservedSlug } from "@/lib/reserved-slugs";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ businessSlug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { businessSlug } = await params;
  if (isReservedSlug(businessSlug)) {
    return { title: "TemVagas" };
  }
  return publicBookingMetadata(businessSlug);
}

export default async function ShortBookingPage({ params }: PageProps) {
  const { businessSlug } = await params;
  if (isReservedSlug(businessSlug)) {
    notFound();
  }
  return <PublicBookingPage businessSlug={businessSlug} />;
}
