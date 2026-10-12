"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type ICellRendererParams,
  type IRowNode,
  type ProcessCellForExportParams,
  type RowSelectionOptions,
} from "ag-grid-community";
import { spendingRowsAction } from "@/app/actions";
import { BulkDecisionBar, type BulkItem } from "./bulk-approvals";
import { SpendingCharts } from "./spending-charts";
import { formatUsd } from "@/lib/money";
import type { SpendingRow } from "@/lib/services/overview";

// The spending table (AG Grid Community): Cosign's control room. Every
// purchase request across the owner's agents, live - new requests slide in and
// changed cells flash as agents buy. Waiting purchases can be ticked and
// approved or declined right here. The tiles and the pinned totals row follow
// whatever the grid is showing.

const POLL_MS = 5000;
type Pinned = { pinned: true; label: string; paidCents: number; count: number };

ModuleRegistry.registerModules([AllCommunityModule]);

// Built from Cosign's own tokens, so light and dark follow the site theme.
const theme = themeQuartz.withParams({
  accentColor: "var(--ballpoint)",
  backgroundColor: "var(--sheet)",
  foregroundColor: "var(--ink)",
  borderColor: "var(--rule)",
  chromeBackgroundColor: "var(--paper)",
  headerBackgroundColor: "var(--paper)",
  headerTextColor: "var(--ink-soft)",
  headerFontWeight: 700,
  oddRowBackgroundColor: "transparent",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  wrapperBorderRadius: 6,
  cellHorizontalPadding: 14,
});

// Stamp tone and the short word on it (the same words as the rest of Cosign).
const STAMP: Record<SpendingRow["outcome"], { tone: string; label: string }> = {
  Paid: { tone: "allow", label: "Paid" },
  "Waiting for you": { tone: "ask", label: "Ask you" },
  Confirming: { tone: "ask", label: "Checking" },
  Blocked: { tone: "deny", label: "Blocked" },
  Declined: { tone: "deny", label: "Declined" },
  Expired: { tone: "deny", label: "Expired" },
  "Not paid": { tone: "deny", label: "Not paid" },
};
const FILTERS = ["All", "Paid", "Waiting for you", "Blocked", "Declined"] as const;
type Filter = (typeof FILTERS)[number];

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Agent-supplied text must not run as a spreadsheet formula when the CSV is opened.
function csvSafe(p: ProcessCellForExportParams): string {
  const v = p.value === null || p.value === undefined ? "" : String(p.value);
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const toItem = (r: SpendingRow): BulkItem => ({
  value: `${r.approvalId}|${r.cartHash}|${r.amountCents}`,
  cents: r.amountCents,
  flagged: r.aiCheck === "Flagged",
  label: `${r.agent} - ${r.store}`,
});

export function SpendingGrid({ rows: initial }: { rows: SpendingRow[] }) {
  const api = useRef<GridApi<SpendingRow> | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  // The grid reads the outcome filter through a ref, so it never sees a stale value.
  const filterRef = useRef<Filter>("All");
  const [rows] = useState<SpendingRow[]>(initial);
  // Stable agent order for chart colours: oldest activity first, new agents appended.
  const [agentOrder, setAgentOrder] = useState<string[]>(() => [...new Set([...initial].reverse().map((r) => r.agentId))]);
  const [shown, setShown] = useState<SpendingRow[]>(initial);
  const [selected, setSelected] = useState<BulkItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date>(() => new Date());
  const [live, setLive] = useState(true);

  // Live: poll while the tab is visible; apply only what changed, so new rows
  // flash and changed cells blink instead of the table re-drawing.
  useEffect(() => {
    if (!live) return;
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== "visible" || !api.current) return;
      try {
        const next = await spendingRowsAction();
        const grid = api.current;
        if (!grid || stop) return;
        const have = new Map<string, SpendingRow>();
        grid.forEachNode((n) => n.data && have.set(n.data.id, n.data));
        const add = next.filter((r) => !have.has(r.id));
        const update = next.filter((r) => {
          const old = have.get(r.id);
          return old && JSON.stringify(old) !== JSON.stringify(r);
        });
        if (add.length) setAgentOrder((order) => [...order, ...[...new Set(add.map((r) => r.agentId))].filter((id) => !order.includes(id))]);
        if (add.length || update.length) {
          const res = grid.applyTransaction({ add, update, addIndex: 0 });
          if (res?.add.length) grid.flashCells({ rowNodes: res.add, flashDuration: 1600 });
        }
        setUpdatedAt(new Date());
      } catch {
        // A blip (or rate limit): try again on the next tick.
      }
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [live]);

  const rowSelection = useMemo<RowSelectionOptions<SpendingRow>>(
    () => ({
      mode: "multiRow",
      // Only purchases waiting for the owner can be decided; flagged ones are
      // ticked one by one (no header "select all").
      isRowSelectable: (n) => n.data?.outcome === "Waiting for you" && !!n.data.approvalId,
      checkboxes: (p) => p.data?.outcome === "Waiting for you",
      headerCheckbox: false,
      enableClickSelection: false,
    }),
    [],
  );

  const columns = useMemo<ColDef<SpendingRow>[]>(
    () => [
      {
        field: "at",
        headerName: "When",
        sort: "desc",
        width: 150,
        valueFormatter: (p) => (p.node?.rowPinned ? "Totals" : p.value ? when.format(new Date(p.value)) : ""),
        cellClass: (p) => (p.node.rowPinned ? "grid-total-label" : undefined),
        filter: false,
      },
      {
        field: "agent",
        headerName: "Agent",
        minWidth: 170,
        filter: "agTextColumnFilter",
        cellRenderer: (p: ICellRendererParams<SpendingRow>) =>
          p.data && !p.node.rowPinned ? (
            <Link href={`/agents/${p.data.agentId}`} className="grid-link">
              {p.data.agent}
            </Link>
          ) : null,
      },
      { field: "store", headerName: "Store", width: 130, filter: "agTextColumnFilter" },
      {
        field: "items",
        headerName: "What",
        flex: 1,
        minWidth: 220,
        filter: "agTextColumnFilter",
        tooltipField: "items",
        valueGetter: (p) => (p.node?.rowPinned ? (p.data as unknown as Pinned).label : p.data?.items),
      },
      {
        colId: "amount",
        headerName: "Amount",
        width: 120,
        type: "rightAligned",
        filter: "agNumberColumnFilter",
        valueGetter: (p) => (p.node?.rowPinned ? (p.data as unknown as Pinned).paidCents / 100 : p.data ? p.data.amountCents / 100 : null),
        valueFormatter: (p) => (typeof p.value === "number" ? formatUsd(Math.round(p.value * 100)) : ""),
        cellClass: (p) => (p.node.rowPinned ? "grid-mono grid-total" : "grid-mono"),
        enableCellChangeFlash: true,
      },
      {
        field: "outcome",
        headerName: "Outcome",
        width: 140,
        minWidth: 130,
        filter: "agTextColumnFilter",
        enableCellChangeFlash: true,
        cellRenderer: (p: ICellRendererParams<SpendingRow>) =>
          p.node.rowPinned ? (
            <span className="grid-total-label">paid</span>
          ) : p.data ? (
            <span className={`stamp stamp-${STAMP[p.data.outcome].tone}`} title={p.data.outcome}>
              {STAMP[p.data.outcome].label}
            </span>
          ) : null,
      },
      { field: "aiCheck", headerName: "AI check", width: 110, filter: "agTextColumnFilter" },
      { field: "market", headerName: "Market (Channel3)", width: 230, filter: "agTextColumnFilter", tooltipField: "market" },
      { field: "why", headerName: "Why", flex: 1, minWidth: 240, filter: "agTextColumnFilter", tooltipField: "why" },
      { field: "purpose", headerName: "Agent said", flex: 1, minWidth: 220, filter: "agTextColumnFilter", tooltipField: "purpose", hide: true },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<SpendingRow>>(() => ({ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: false }), []);

  const recount = useCallback(() => {
    const out: SpendingRow[] = [];
    api.current?.forEachNodeAfterFilter((n) => n.data && out.push(n.data));
    setShown(out);
    // Keep the selection to rows that can still be decided.
    const still = (api.current?.getSelectedRows() ?? []).filter((r) => r.outcome === "Waiting for you" && r.approvalId);
    setSelected(still.map(toItem));
  }, []);

  const pickFilter = (f: Filter) => {
    filterRef.current = f;
    setFilter(f);
    api.current?.onFilterChanged();
  };

  const paid = shown.filter((r) => r.outcome === "Paid");
  const waiting = shown.filter((r) => r.outcome === "Waiting for you");
  const stopped = shown.filter((r) => r.outcome === "Blocked" || r.outcome === "Declined");
  const sum = (list: SpendingRow[]) => list.reduce((s, r) => s + r.amountCents, 0);
  const pinned = useMemo<Pinned[]>(
    () => [{ pinned: true, label: `${shown.length} shown`, paidCents: shown.filter((r) => r.outcome === "Paid").reduce((s, r) => s + r.amountCents, 0), count: shown.length }],
    [shown],
  );

  if (rows.length === 0) {
    return (
      <div className="empty">
        <h2>No purchases yet</h2>
        <p>When your agents ask to pay a store, every request shows up here - paid, waiting for you, or blocked.</p>
      </div>
    );
  }

  return (
    <div className="spending">
      <dl className="spend-tiles" aria-live="polite">
        <div className="spend-tile">
          <dt>Paid</dt>
          <dd className="grid-mono">{formatUsd(sum(paid))}</dd>
          <span>{paid.length} {paid.length === 1 ? "purchase" : "purchases"}</span>
        </div>
        <div className="spend-tile">
          <dt>Waiting for you</dt>
          <dd className="grid-mono">{formatUsd(sum(waiting))}</dd>
          <span>{waiting.length} {waiting.length === 1 ? "purchase" : "purchases"}</span>
        </div>
        <div className="spend-tile">
          <dt>Stopped</dt>
          <dd className="grid-mono">{formatUsd(sum(stopped))}</dd>
          <span>
            {stopped.length} blocked or declined - nothing charged
          </span>
        </div>
      </dl>

      <SpendingCharts shown={shown} agentOrder={agentOrder} />

      <div className="spend-tools">
        <div className="chip-row" role="group" aria-label="Outcome">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => pickFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="spend-tools-right">
          <button type="button" className={`live-pill${live ? " is-live" : ""}`} aria-pressed={live} onClick={() => setLive(!live)} title={live ? "Pause live updates" : "Resume live updates"}>
            <span className="live-dot" aria-hidden="true" />
            {live ? `Live - updated ${updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Paused"}
          </button>
          <label className="visually-hidden" htmlFor="spend-search">
            Search purchases
          </label>
          <input
            id="spend-search"
            type="search"
            className="field-input spend-search"
            placeholder="Search agent, store, items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="button button-quiet"
            onClick={() =>
              api.current?.exportDataAsCsv({
                fileName: `cosign-spending-${new Date().toISOString().slice(0, 10)}.csv`,
                allColumns: true,
                processCellCallback: csvSafe,
              })
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      <BulkDecisionBar
        formId="bulk-grid"
        back="/spending"
        renderInputs
        selected={selected}
        hint="Tick waiting purchases in the table to decide several at once"
        onSelectAll={() => {
          const grid = api.current;
          if (!grid) return;
          const nodes: IRowNode<SpendingRow>[] = [];
          grid.forEachNodeAfterFilter((n) => {
            if (n.data?.outcome === "Waiting for you" && n.data.approvalId && n.data.aiCheck !== "Flagged") nodes.push(n);
          });
          grid.setNodesSelected({ nodes, newValue: true });
        }}
        onClear={() => api.current?.deselectAll()}
      />

      <div className="spend-grid">
        <AgGridReact<SpendingRow>
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          getRowId={(p) => (p.data as SpendingRow | Pinned & { id?: string }).id ?? "totals"}
          rowSelection={rowSelection}
          onSelectionChanged={recount}
          pinnedBottomRowData={pinned}
          quickFilterText={search}
          isExternalFilterPresent={() => filterRef.current !== "All"}
          doesExternalFilterPass={(n: IRowNode<SpendingRow>) => !n.data || n.data.outcome === filterRef.current}
          pagination
          paginationPageSize={25}
          paginationPageSizeSelector={[25, 50, 100]}
          domLayout="autoHeight"
          tooltipShowDelay={300}
          enableCellTextSelection
          onGridReady={(e) => {
            api.current = e.api;
            recount();
          }}
          onModelUpdated={recount}
          cellFlashDuration={1200}
          overlayNoRowsTemplate="<span>No purchases match these filters.</span>"
        />
      </div>
    </div>
  );
}
