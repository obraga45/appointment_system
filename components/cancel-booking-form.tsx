"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cancelAppointmentByToken } from "@/actions/appointments";
import { Button } from "@/components/ui/button";

export function CancelBookingForm({ token, disabled }: { token: string; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function cancel() {
    setPending(true);
    const result = await cancelAppointmentByToken(token);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setDone(true);
  }

  if (disabled) {
    return <p className="text-sm text-muted-foreground">Esta marcação já foi concluída.</p>;
  }

  if (done) {
    return (
      <p className="text-sm">
        Marcação cancelada. Enviámos uma confirmação por WhatsApp, se o envio estiver activo.
      </p>
    );
  }

  return (
    <Button variant="destructive" disabled={pending} onClick={cancel}>
      {pending ? "A cancelar…" : "Confirmar cancelamento"}
    </Button>
  );
}
