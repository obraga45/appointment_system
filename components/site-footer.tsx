import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-background/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} MarcaJá</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/termos" className="hover:text-foreground">
            Termos
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
