import type { AppointmentStatus } from "@prisma/client";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};

export const STATUS_VARIANT: Record<
  AppointmentStatus,
  "warning" | "success" | "destructive" | "muted"
> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "destructive",
  COMPLETED: "muted",
};
