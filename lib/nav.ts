import {
  CalendarDays,
  LayoutDashboard,
  Scissors,
  Settings,
} from "lucide-react";

export const APP_NAV = [
  { href: "/dashboard", label: "Hoje", icon: LayoutDashboard },
  { href: "/appointments", label: "Marcações", icon: CalendarDays },
  { href: "/services", label: "Serviços", icon: Scissors },
  { href: "/settings", label: "Definições", icon: Settings },
] as const;
