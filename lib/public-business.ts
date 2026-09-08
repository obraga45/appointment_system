import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getPublicBusiness = cache(async (businessSlug: string) => {
  return prisma.user.findUnique({
    where: { slug: businessSlug },
    select: {
      id: true,
      slug: true,
      businessName: true,
      depositEnabled: true,
      depositAmount: true,
      depositMbWay: true,
      depositIban: true,
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
