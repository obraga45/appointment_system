"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createService, deleteService, toggleService, updateService } from "@/actions/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type ServiceRow = {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  description: string | null;
  isActive: boolean;
};

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(service: ServiceRow) {
    setEditing(service);
    setOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      durationMinutes: Number(form.get("durationMinutes")),
      price: Number(form.get("price")),
      description: String(form.get("description") ?? ""),
      isActive: true,
    };

    startTransition(async () => {
      const result = editing
        ? await updateService(editing.id, payload)
        : await createService(payload);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(editing ? "Serviço atualizado" : "Serviço criado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex">
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          Novo serviço
        </Button>
      </div>
      {services.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Ainda não tem serviços. Crie o primeiro para abrir a agenda pública.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {services.map((service) => (
            <Card key={service.id} className={service.isActive ? "" : "opacity-70"}>
              <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="break-words">{service.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.durationMinutes} min · {formatCurrency(service.price)}
                    {service.isActive ? "" : " · inativo"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex">
                  <Button size="sm" className="px-2 text-[11px] sm:px-3 sm:text-xs" variant="outline" onClick={() => openEdit(service)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        await toggleService(service.id);
                        router.refresh();
                      })
                    }
                  >
                    {service.isActive ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteService(service.id);
                        router.refresh();
                      })
                    }
                  >
                    Eliminar
                  </Button>
                </div>
              </CardHeader>
              {service.description ? (
                <CardContent className="text-sm text-muted-foreground">{service.description}</CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required defaultValue={editing?.name} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="durationMinutes">Duração (min)</Label>
                <Input
                  id="durationMinutes"
                  name="durationMinutes"
                  type="number"
                  min={10}
                  step={5}
                  required
                  defaultValue={editing?.durationMinutes ?? 30}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Preço (€)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  defaultValue={editing?.price ?? "0"}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" name="description" defaultValue={editing?.description ?? ""} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
