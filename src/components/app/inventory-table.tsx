"use client";

import { IS_STATIC_DEMO } from "@/lib/env";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import type { DemandTrend, RiskLevel, StockStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/inventory";
import { Card, EmptyState, Table, Td, Th, buttonClass } from "@/components/ui";
import { RiskBadge, StockStatusBadge, TrendIndicator } from "./badges";
import { cn, fmtCurrency, fmtNumber } from "@/lib/utils";

export interface InventoryRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  supplier: string;
  stock: number;
  value: number;
  velocity: number;
  daysOfStock: number | null;
  trend: DemandTrend;
  trendPct: number;
  risk: RiskLevel;
  status: StockStatus;
  action: string;
  actionHref?: string;
}

type SortKey = "sku" | "name" | "stock" | "value" | "velocity" | "daysOfStock" | "trendPct" | "risk";
const RISK_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, none: 3 };
const PAGE_SIZES = [25, 50, 100];

export function InventoryTable({ rows, initialStatus }: { rows: InventoryRow[]; initialStatus?: string }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const warehouses = useMemo(() => [...new Set(rows.map((r) => r.warehouse))].sort(), [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (!term || `${r.sku} ${r.name} ${r.supplier}`.toLowerCase().includes(term)) &&
        (!category || r.category === category) &&
        (!warehouse || r.warehouse === warehouse) &&
        (!status || r.status === status) &&
        (!risk || r.risk === risk),
    );
    const val = (r: InventoryRow): number | string => {
      if (sort.key === "risk") return RISK_RANK[r.risk];
      if (sort.key === "daysOfStock") return r.daysOfStock ?? 1e9;
      return r[sort.key];
    };
    return out.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number)) * sort.dir;
    });
  }, [rows, q, category, warehouse, status, risk, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const visible = filtered.slice(page * size, (page + 1) * size);
  const totalValue = filtered.reduce((a, r) => a + r.value, 0);

  const header = (key: SortKey, label: string, align?: "right") => (
    <Th align={align}>
      <button
        type="button"
        onClick={() => {
          setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : key === "sku" || key === "name" || key === "risk" || key === "daysOfStock" ? 1 : -1 }));
          setPage(0);
        }}
        className={cn("inline-flex items-center gap-1 uppercase", sort.key === key && "text-ink")}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </Th>
  );

  const sel = (label: string, value: string, set: (v: string) => void, opts: { v: string; l: string }[]) => (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => {
        set(e.target.value);
        setPage(0);
      }}
      className={cn("h-8 max-w-[200px] rounded-md border bg-white px-2 text-[13px] outline-none", value ? "border-brand-200 bg-brand-50/50 text-brand-900" : "border-line-strong text-ink-2")}
    >
      <option value="">{label}: All</option>
      {opts.map((o) => (
        <option key={o.v} value={o.v}>
          {label}: {o.l}
        </option>
      ))}
    </select>
  );

  const exportCsv = () => {
    const head = ["SKU", "Product", "Category", "Warehouse", "Stock", "Inventory value", "Weekly velocity", "Days of stock", "Demand trend", "Stockout risk", "Status"];
    const lines = filtered.map((r) => [r.sku, r.name, r.category, r.warehouse, r.stock, r.value.toFixed(2), r.velocity, r.daysOfStock ?? "", r.trend, r.risk, STATUS_META[r.status].label].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = "inventory.csv";
    a.click();
  };

  const anyFilter = q || category || warehouse || status || risk;

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 xl:flex-row xl:items-center">
        <div className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-white px-2.5 xl:w-72">
          <Search className="h-3.5 w-3.5 text-faint" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search SKU, product or supplier…"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sel("Category", category, setCategory, categories.map((c) => ({ v: c, l: c })))}
          {sel("Warehouse", warehouse, setWarehouse, warehouses.map((c) => ({ v: c, l: c })))}
          {sel("Status", status, setStatus, (Object.keys(STATUS_META) as StockStatus[]).map((s) => ({ v: s, l: STATUS_META[s].label })))}
          {sel("Risk", risk, setRisk, [
            { v: "high", l: "High" },
            { v: "medium", l: "Medium" },
            { v: "low", l: "Low" },
            { v: "none", l: "None" },
          ])}
          {anyFilter && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setCategory("");
                setWarehouse("");
                setStatus("");
                setRisk("");
                setPage(0);
              }}
              className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-slate-100"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 xl:ml-auto">
          <span className="text-xs text-muted">
            {filtered.length} SKUs · <span className="tabular font-medium text-ink">{fmtCurrency(totalValue)}</span>
          </span>
          {!IS_STATIC_DEMO && (
            <button type="button" onClick={exportCsv} className={buttonClass("secondary", "sm")}>
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search className="h-4 w-4" />} title="No products found" description="Try a different search or clear the filters." />
      ) : (
        <Table className="max-h-[calc(100vh-260px)]">
          <thead>
            <tr>
              {header("sku", "SKU")}
              {header("name", "Product")}
              <Th>Category</Th>
              <Th>Warehouse</Th>
              {header("stock", "Stock", "right")}
              {header("value", "Inventory value", "right")}
              {header("velocity", "Sales / wk", "right")}
              {header("daysOfStock", "Days of stock", "right")}
              {header("trendPct", "Demand trend")}
              {header("risk", "Stockout risk")}
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-subtle">
                <Td className="whitespace-nowrap font-mono text-[11.5px]">
                  <Link href={`/products/${encodeURIComponent(r.sku)}`} className="text-ink-2 hover:text-brand-600">
                    {r.sku}
                  </Link>
                </Td>
                <Td className="max-w-[280px]">
                  <Link href={`/products/${encodeURIComponent(r.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                    {r.name}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-[12.5px]">{r.category}</Td>
                <Td className="whitespace-nowrap text-[12.5px]">{r.warehouse}</Td>
                <Td align="right">{fmtNumber(r.stock)}</Td>
                <Td align="right" className="font-medium text-ink">{fmtCurrency(r.value)}</Td>
                <Td align="right">{fmtNumber(r.velocity, 1)}</Td>
                <Td align="right" className={cn(r.daysOfStock !== null && r.daysOfStock < 14 && "font-semibold text-red-600")}>
                  {r.daysOfStock === null ? "—" : r.daysOfStock > 730 ? ">730" : fmtNumber(r.daysOfStock)}
                </Td>
                <Td><TrendIndicator trend={r.trend} pct={r.trendPct} /></Td>
                <Td><RiskBadge risk={r.risk} /></Td>
                <Td><StockStatusBadge status={r.status} /></Td>
                <Td className="whitespace-nowrap text-[12.5px]">
                  {r.actionHref ? (
                    <Link href={r.actionHref} className="font-medium text-brand-700 hover:underline">
                      {r.action}
                    </Link>
                  ) : (
                    <span className="text-faint">{r.action}</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted">
        <div className="flex items-center gap-2">
          Rows per page
          <select
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(0);
            }}
            className="h-7 rounded border border-line-strong bg-white px-1.5"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2">
            {filtered.length ? page * size + 1 : 0}–{Math.min(filtered.length, (page + 1) * size)} of {filtered.length}
          </span>
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={buttonClass("secondary", "sm")} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className={buttonClass("secondary", "sm")} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
