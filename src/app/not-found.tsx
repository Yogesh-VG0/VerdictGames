import Link from "next/link";
import { Gamepad2, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent shadow-lg shadow-accent/10">
        <Gamepad2 className="h-8 w-8" />
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">404</p>
      <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-xl text-sm text-secondary sm:text-base">
        The page you&apos;re looking for isn&apos;t here, or it may have moved somewhere else on verdict.games.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Home className="h-4 w-4" />
          Back to home
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/30 hover:text-accent"
        >
          <Search className="h-4 w-4" />
          Browse games
        </Link>
      </div>
    </div>
  );
}
