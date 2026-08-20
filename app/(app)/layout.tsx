import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar, MobileBottomNav, MobileTopBar } from "@/components/app-sidebar";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardGroupLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh">
      <AppSidebar businessName={user.businessName} slug={user.slug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar businessName={user.businessName} />
        <main className="min-w-0 flex-1 bg-background p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-8 md:pb-8">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
