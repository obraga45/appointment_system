"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { APP_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppSidebar({
  businessName,
  slug,
}: {
  businessName: string;
  slug: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="px-5 py-6">
        <Link href="/dashboard" className="font-serif text-2xl font-semibold">
          MarcaJá
        </Link>
        <p className="mt-2 truncate text-sm text-sidebar-foreground/70">{businessName}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {APP_NAV.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 p-4">
        <p className="truncate px-1 text-xs text-sidebar-foreground/60">/book/{slug}</p>
        <form action={logoutUser}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileTopBar({ businessName }: { businessName: string }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="min-w-0">
        <Link href="/dashboard" className="font-serif text-lg font-semibold">
          MarcaJá
        </Link>
        <p className="truncate text-xs text-muted-foreground">{businessName}</p>
      </div>
      <form action={logoutUser}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-4">
        {APP_NAV.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
