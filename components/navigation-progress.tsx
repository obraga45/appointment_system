"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function startPageProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("temvagas:navigate"));
  }
}

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const pathKey = `${pathname}?${searchParams.toString()}`;
  const previousPath = useRef(pathKey);

  useEffect(() => {
    if (previousPath.current === pathKey) {
      return;
    }
    previousPath.current = pathKey;
    if (!active) {
      return;
    }
    setDone(true);
    const hide = window.setTimeout(() => {
      setActive(false);
      setDone(false);
    }, 260);
    return () => window.clearTimeout(hide);
  }, [pathKey, active]);

  useEffect(() => {
    if (!active || done) {
      return;
    }
    const failsafe = window.setTimeout(() => {
      setDone(true);
      window.setTimeout(() => {
        setActive(false);
        setDone(false);
      }, 260);
    }, 8000);
    return () => window.clearTimeout(failsafe);
  }, [active, done]);

  useEffect(() => {
    function begin(href?: string | null) {
      if (href) {
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) {
            return;
          }
          if (url.pathname === window.location.pathname && url.search === window.location.search) {
            return;
          }
        } catch {
          return;
        }
      }
      setDone(false);
      setActive(true);
    }

    function onNavigate() {
      begin();
    }

    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      begin(href);
    }

    window.addEventListener("temvagas:navigate", onNavigate);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("temvagas:navigate", onNavigate);
      document.removeEventListener("click", onClick);
    };
  }, []);

  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden">
      <div className={done ? "nav-progress nav-progress-done" : "nav-progress"} />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
