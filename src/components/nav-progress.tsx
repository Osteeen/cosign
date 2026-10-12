"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// A thin ink line across the top while the next page loads. Pages fetch their
// data on the server before they show, so without it a click looks ignored.
// Starts on any internal link click (after a short delay, so fast pages never
// flash it) and finishes when the URL changes.

const SHOW_AFTER_MS = 120;
const GIVE_UP_MS = 15_000;

export function NavProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const timers = useRef<{ show?: number; trickle?: number; giveUp?: number; hide?: number }>({});
  const value = useRef(0);
  const visible = useRef(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  const paint = (scale: number, opacity: number, animate: boolean) => {
    const el = bar.current;
    if (!el) return;
    el.style.transition = animate ? "" : "none";
    el.style.transform = `scaleX(${scale})`;
    el.style.opacity = String(opacity);
  };

  const clear = () => {
    const t = timers.current;
    window.clearTimeout(t.show);
    window.clearInterval(t.trickle);
    window.clearTimeout(t.giveUp);
    window.clearTimeout(t.hide);
    timers.current = {};
  };

  const finish = () => {
    clear();
    if (!visible.current) return;
    visible.current = false;
    paint(1, 0, true);
    timers.current.hide = window.setTimeout(() => paint(0, 0, false), 450);
  };

  const start = () => {
    clear();
    timers.current.show = window.setTimeout(() => {
      visible.current = true;
      value.current = 0.12;
      paint(0, 1, false);
      requestAnimationFrame(() => paint(value.current, 1, true));
      // Creeps towards 90% and waits there for the page.
      timers.current.trickle = window.setInterval(() => {
        value.current += (0.9 - value.current) * 0.12;
        paint(value.current, 1, true);
      }, 250);
    }, SHOW_AFTER_MS);
    timers.current.giveUp = window.setTimeout(finish, GIVE_UP_MS);
  };

  // The new page is here.
  useEffect(() => {
    finish();
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin) return;
      // Same page, or only the #hash changes: nothing loads.
      if (to.pathname === location.pathname && to.search === location.search) return;
      start();
    };
    // Capture phase: Next's <Link> cancels the browser's default click before
    // it would bubble up here.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);

  return <div ref={bar} className="nav-progress" aria-hidden="true" />;
}
