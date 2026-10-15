"use client";

import { useEffect, useRef, type ComponentProps } from "react";

// A section whose entrance plays once, when it first scrolls into view (CSS
// keys off data-reveal). Without JavaScript, or with reduced motion, it simply
// shows as it is.
export function RevealSection(props: ComponentProps<"section">) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.reveal = "pending";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <section ref={ref} {...props} />;
}
