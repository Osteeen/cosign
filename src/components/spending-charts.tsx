"use client";

import { useEffect, useMemo, useState } from "react";
import { AgCharts } from "ag-charts-react";
import { AllCommunityModule, ModuleRegistry, type AgCartesianChartOptions } from "ag-charts-community";
import { formatUsd } from "@/lib/money";
import type { SpendingRow } from "@/lib/services/overview";

// AG Charts above the spending grid: where the money went, by day and agent,
// and by store. They chart the rows the grid is showing, so a filter or search
// in the grid narrows the charts too. Paid purchases only.

ModuleRegistry.registerModules([AllCommunityModule]);

// Categorical slots, validated for colour-blind separation on Cosign's own
// light (#fbfcfd) and dark (#151d31) surfaces. A sixth agent and beyond fold
// into "Other" (neutral) - never a generated colour.
const SLOTS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
};
const OTHER = { light: "#8b93a7", dark: "#6b7590" };
const DAYS = 28;
const MIN_DAYS = 7;

// Canvas charts can't read CSS variables: resolve Cosign's tokens, and redraw
// when the theme toggle or the system setting changes.
function useTokens() {
  const read = () => {
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const stamp = document.documentElement.dataset.theme;
    const dark = stamp ? stamp === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    // The Archivo family Next.js registered (a real name; canvas can't use var()).
    const archivo = v("--font-archivo");
    return { dark, sheet: v("--sheet"), ink: v("--ink"), soft: v("--ink-soft"), rule: v("--rule"), font: archivo ? `${archivo}, sans-serif` : "sans-serif" };
  };
  const [tokens, setTokens] = useState<ReturnType<typeof read> | null>(null);
  useEffect(() => {
    const update = () => setTokens(read());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return tokens;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function SpendingCharts({ shown, agentOrder }: { shown: SpendingRow[]; agentOrder: string[] }) {
  const t = useTokens();
  const paid = useMemo(() => shown.filter((r) => r.outcome === "Paid"), [shown]);

  // Colour follows the agent, never its rank: slots come from a stable order
  // (oldest activity first), so filtering never repaints the agents that remain.
  const slotOf = useMemo(() => new Map(agentOrder.map((id, i) => [id, i])), [agentOrder]);

  const byDay = useMemo<AgCartesianChartOptions | null>(() => {
    if (!t || paid.length === 0) return null;
    const mode = t.dark ? "dark" : "light";
    const series = new Map<string, { key: string; name: string; color: string }>();
    const keyFor = (r: SpendingRow) => {
      const slot = slotOf.get(r.agentId) ?? 99;
      if (slot < SLOTS.light.length) {
        const key = `a${slot}`;
        if (!series.has(key)) series.set(key, { key, name: r.agent, color: SLOTS[mode][slot]! });
        return key;
      }
      if (!series.has("other")) series.set("other", { key: "other", name: "Other agents", color: OTHER[mode] });
      return "other";
    };

    // From the first day with spending in view (at least a week, at most DAYS) to today.
    const today = new Date();
    const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const first = midnight(new Date(Math.min(...paid.map((r) => Date.parse(r.at)))));
    const span = Math.round((midnight(today).getTime() - first.getTime()) / 86_400_000) + 1;
    const length = Math.min(DAYS, Math.max(MIN_DAYS, span));
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (length - 1));
    const days = Array.from({ length }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { key: dayKey(d), day: dayLabel.format(d) } as Record<string, string | number>;
    });
    const index = new Map(days.map((d, i) => [d.key as string, i]));
    for (const r of paid) {
      const i = index.get(dayKey(new Date(r.at)));
      if (i === undefined) continue;
      const k = keyFor(r);
      days[i]![k] = Number(days[i]![k] ?? 0) + r.amountCents / 100;
    }
    const ordered = [...series.values()].sort((a, b) => (a.key === "other" ? 1 : b.key === "other" ? -1 : a.key.localeCompare(b.key)));
    return {
      data: days,
      background: { fill: t.sheet },
      theme: { baseTheme: t.dark ? "ag-default-dark" : "ag-default", params: { fontFamily: t.font, foregroundColor: t.ink, backgroundColor: t.sheet, gridLineColor: t.rule, axisLineColor: t.rule } },
      series: ordered.map((s) => ({
        type: "bar" as const,
        xKey: "day",
        yKey: s.key,
        yName: s.name,
        stacked: true,
        fill: s.color,
        // 2px surface gap between stacked segments.
        stroke: t.sheet,
        strokeWidth: 2,
        cornerRadius: 4,
        tooltip: {
          renderer: ({ datum, yKey }: { datum: Record<string, string | number>; yKey: string }) => ({
            heading: String(datum.day),
            title: s.name,
            data: [{ label: "Paid", value: formatUsd(Math.round(Number(datum[yKey] ?? 0) * 100)) }],
          }),
        },
      })),
      axes: {
        x: { type: "category", position: "bottom", label: { color: t.soft }, line: { stroke: t.rule } },
        y: {
          type: "number",
          position: "left",
          label: { color: t.soft, formatter: ({ value }: { value: number }) => `$${value}` },
          gridLine: { style: [{ stroke: t.rule, lineDash: [2, 4] }] },
        },
      },
      legend: { enabled: series.size > 1, position: "bottom" },
    } as AgCartesianChartOptions;
  }, [t, paid, slotOf]);

  const byStore = useMemo<AgCartesianChartOptions | null>(() => {
    if (!t || paid.length === 0) return null;
    const totals = new Map<string, number>();
    for (const r of paid) totals.set(r.store, (totals.get(r.store) ?? 0) + r.amountCents);
    const data = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([store, cents]) => ({ store, paid: cents / 100, label: formatUsd(cents) }));
    return {
      data,
      background: { fill: t.sheet },
      theme: { baseTheme: t.dark ? "ag-default-dark" : "ag-default", params: { fontFamily: t.font, foregroundColor: t.ink, backgroundColor: t.sheet, gridLineColor: t.rule, axisLineColor: t.rule } },
      series: [
        {
          type: "bar",
          direction: "horizontal",
          xKey: "store",
          yKey: "paid",
          yName: "Paid",
          fill: SLOTS[t.dark ? "dark" : "light"][0],
          cornerRadius: 4,
          // Direct value labels in ink (text never wears the series colour).
          label: { formatter: ({ datum }: { datum: { label: string } }) => datum.label, placement: "outside-end", color: t.ink },
          tooltip: {
            renderer: ({ datum }: { datum: { store: string; label: string } }) => ({ heading: datum.store, data: [{ label: "Paid", value: datum.label }] }),
          },
        },
      ],
      axes: {
        x: { type: "category", position: "left", label: { color: t.ink }, line: { stroke: t.rule } },
        y: { type: "number", position: "bottom", label: { color: t.soft, formatter: ({ value }: { value: number }) => `$${value}` }, gridLine: { style: [{ stroke: t.rule, lineDash: [2, 4] }] } },
      },
      legend: { enabled: false },
    } as AgCartesianChartOptions;
  }, [t, paid]);

  if (!t) return <div className="spend-charts" aria-hidden="true" />;
  if (paid.length === 0) {
    return (
      <div className="spend-charts">
        <p className="muted spend-charts-empty">No paid purchases in this view yet - charts appear once an agent pays a store.</p>
      </div>
    );
  }

  return (
    <div className="spend-charts">
      <figure className="spend-chart">
        <figcaption>Paid per day, by agent</figcaption>
        <div className="spend-chart-box">{byDay ? <AgCharts options={byDay} style={{ height: "100%", width: "100%" }} /> : null}</div>
      </figure>
      <figure className="spend-chart spend-chart-narrow">
        <figcaption>Paid by store</figcaption>
        <div className="spend-chart-box">{byStore ? <AgCharts options={byStore} style={{ height: "100%", width: "100%" }} /> : null}</div>
      </figure>
    </div>
  );
}
