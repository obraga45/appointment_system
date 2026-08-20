"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyPublicLink({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link do cliente copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <code className="block min-w-0 break-all rounded-lg bg-secondary px-3 py-2 text-xs sm:flex-1 sm:truncate sm:text-sm">{url}</code>
      <Button type="button" variant="outline" className="w-full shrink-0 sm:w-auto" onClick={copy}>
        Copiar link
      </Button>
    </div>
  );
}
