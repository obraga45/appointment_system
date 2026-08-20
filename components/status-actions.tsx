"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAppointmentStatus } from "@/actions/appointments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS, STATUS_VARIANT } from "@/lib/status";
import type { AppointmentStatus } from "@prisma/client";

export function StatusActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: AppointmentStatus) {
    startTransition(async () => {
      const result = await updateAppointmentStatus({ appointmentId, status: next });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Estado atualizado");
      router.refresh();
    });
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
      {status !== "CANCELLED" && status !== "COMPLETED" ? (
        <>
          {status === "PENDING" ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => change("CONFIRMED")}>
              Confirmar
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => change("COMPLETED")}>
            Concluir
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("CANCELLED")}>
            Cancelar
          </Button>
        </>
      ) : null}
    </div>
  );
}
