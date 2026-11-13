"use client";

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

/** Immediate feedback even when links deliberately disable costly prefetch. */
export default function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = pathname + (search ? `?${search}` : '');
  const [target, setTarget] = useState<string | null>(null);
  const pending = target !== null && target !== current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element)?.closest('a');
      if (!anchor || anchor.download || (anchor.target && anchor.target !== '_self')) return;
      const url = new URL(anchor.href, location.href);
      const next = url.pathname + url.search;
      if (url.origin !== location.origin || next === location.pathname + location.search) return;
      setTarget(next);
      clearTimeout(timer);
      timer = setTimeout(() => setTarget(null), 20000);
    };
    document.addEventListener('click', onClick, true);
    const clear = () => setTarget(null);
    window.addEventListener('pageshow', clear);
    window.addEventListener('popstate', clear);
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('pageshow', clear); window.removeEventListener('popstate', clear); clearTimeout(timer); };
  }, []);

  if (!pending) return null;
  return <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
    <div className="h-1 bg-accent motion-safe:animate-pulse" />
    <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-lg">
      <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" /> Loading page…
    </div>
  </div>;
}
