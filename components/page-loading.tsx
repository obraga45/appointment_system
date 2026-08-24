export function PageLoading({ label = "A carregar…" }: { label?: string }) {
  return (
    <div className="mx-auto max-w-5xl space-y-5" role="status" aria-live="polite" aria-label={label}>
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-52 animate-pulse rounded-xl bg-muted" />
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function CenteredLoading({ label = "A carregar…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4"
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function CardLoading() {
  return <div className="h-40 animate-pulse rounded-xl border bg-muted/50" />;
}
