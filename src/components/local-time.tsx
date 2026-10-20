"use client";

import { useSyncExternalStore } from "react";

// A time of day in the viewer's own time zone. The server can't know it, so
// the server render (and hydration) shows UTC, labelled; the browser then
// swaps in local time.

const DEFAULT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
const noop = () => () => {};

export function LocalTime({ iso, withYear = false }: { iso: string; withYear?: boolean }) {
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  const options: Intl.DateTimeFormatOptions = withYear ? { ...DEFAULT, year: "numeric" } : DEFAULT;
  const date = new Date(iso);
  const text = inBrowser
    ? new Intl.DateTimeFormat("en-US", options).format(date)
    : new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC", timeZoneName: "short" }).format(date);
  return <time dateTime={iso}>{text}</time>;
}
