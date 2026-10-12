"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Download, ExternalLink, Search, X } from "lucide-react";
import type { Priority, Recommendation, RecommendationStatus, RecommendationType } from "@/lib/types";
import { TYPE_META, STATUS_LABEL } from "@/lib/recommendations";
import { cn, fmtCurrency, fmtDate } from "@/lib/utils";
import { Card, EmptyState, Table, Td, Th, buttonClass } from "@/components/ui";
import { PriorityBadge, RecStatusBadge, TypeBadge } from "./badges";
import { StatusActions } from "./status-actions";

export interface RecRow extends Recommendation {
  supplierName?: string;
  warehouseName?: string;
}

interface Props {
  rows: RecRow[];
  canEdit: boolean;
  initial?: { type?: string; priority?: string; status?: string };
  fixedTypes?: RecommendationType[];
  suppliers: string[];
  warehouses: string[];
  categories: string[];
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PAGE = 15;

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn("h-8 max-w-[200px] rounded-md border bg-white px-2 text-[13px] outline-none focus:border-brand-500", value ? "border-brand-200 bg-brand-50/50 text-brand-900" : "border-line-strong text-ink-2")}
    >
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {label}: {o.label}
        </option>
      ))}
    </select>
  );
}

function exportCsv(rows: RecRow[]) {
  const head = ["Priority", "Type", "Product", "SKU", "Issue", "Recommendation", "Expected impact", "Status", "Date"];
  const esc = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) => [r.priority, TYPE_META[r.type].label, r.title, r.sku, r.issue, r.recommendation, r.impactLabel, STATUS_LABEL[r.status], r.createdAt].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "recommendations.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function RecommendationsTable({ rows: initialRows, canEdit, initial, fixedTypes, suppliers, warehouses, categories }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [type, setType] = useState(initial?.type ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "");
  const [supplier, setSupplier] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState(initial?.status ?? "open");
  const [sort, setSort] = useState<{ key: "priority" | "impact" | "date"; dir: 1 | -1 }>({ key: "priority", dir: 1 });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const types = fixedTypes ?? (Object.keys(TYPE_META) as RecommendationType[]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        types.includes(r.type) &&
        (!type || r.type === type) &&
        (!priority || r.priority === priority) &&
        (!supplier || r.supplierName === supplier) &&
        (!warehouse || r.warehouseName === warehouse) &&
        (!category || r.category === category) &&
        (!status || (status === "open" ? r.status === "new" || r.status === "in_review" : r.status === status)) &&
        (!term || `${r.title} ${r.sku ?? ""} ${r.issue} ${r.recommendation}`.toLowerCase().includes(term)),
    );
    out.sort((a, b) => {
      if (sort.key === "impact") return (b.impactValue - a.impactValue) * sort.dir;
      if (sort.key === "date") return (a.createdAt < b.createdAt ? 1 : -1) * sort.dir;
      return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.impactValue - a.impactValue) * sort.dir;
    });
    return out;
  }, [rows, q, type, priority, supplier, warehouse, category, status, sort, types]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const sel = rows.find((r) => r.id === selected);
  const activeFilters = [type, priority, supplier, warehouse, category].filter(Boolean).length + (status !== "open" ? 1 : 0);

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };
  const toggleSort = (key: typeof sort.key) => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }));
  const updateStatus = (id: string, s: RecommendationStatus) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: s } : r)));

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
          <div className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-white px-2.5 lg:w-64">
            <Search className="h-3.5 w-3.5 text-faint" />
            <input value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Search product, SKU, issue…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!fixedTypes || fixedTypes.length > 1 ? (
              <FilterSelect label="Type" value={type} onChange={resetPage(setType)} options={types.map((t) => ({ value: t, label: TYPE_META[t].label }))} />
            ) : null}
            <FilterSelect label="Priority" value={priority} onChange={resetPage(setPriority)} options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
            <FilterSelect label="Supplier" value={supplier} onChange={resetPage(setSupplier)} options={suppliers.map((s) => ({ value: s, label: s }))} />
            <FilterSelect label="Warehouse" value={warehouse} onChange={resetPage(setWarehouse)} options={warehouses.map((s) => ({ value: s, label: s }))} />
            <FilterSelect label="Category" value={category} onChange={resetPage(setCategory)} options={categories.map((s) => ({ value: s, label: s }))} />
            <select
              value={status}
              onChange={(e) => resetPage(setStatus)(e.target.value)}
              aria-label="Status"
              className="h-8 rounded-md border border-line-strong bg-white px-2 text-[13px] text-ink-2 outline-none"
            >
              <option value="open">Status: Open</option>
              <option value="">Status: All</option>
              {(Object.keys(STATUS_LABEL) as RecommendationStatus[]).map((s) => (
                <option key={s} value={s}>
                  Status: {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setType("");
                  setPriority("");
                  setSupplier("");
                  setWarehouse("");
                  setCategory("");
                  setStatus("open");
                  setPage(0);
                }}
                className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-slate-100"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <button type="button" onClick={() => exportCsv(filtered)} className={buttonClass("secondary", "sm", "lg:ml-auto")}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-4 w-4" />} title="No recommendations match these filters" description="Try clearing filters or including completed and dismissed recommendations." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>
                  <button type="button" onClick={() => toggleSort("priority")} className="inline-flex items-center gap-1 uppercase">
                    Priority <ArrowDownUp className="h-3 w-3" />
                  </button>
                </Th>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Issue</Th>
                <Th>Recommendation</Th>
                <Th align="right">
                  <button type="button" onClick={() => toggleSort("impact")} className="inline-flex items-center gap-1 uppercase">
                    Expected impact <ArrowDownUp className="h-3 w-3" />
                  </button>
                </Th>
                <Th>Status</Th>
                <Th>
                  <button type="button" onClick={() => toggleSort("date")} className="inline-flex items-center gap-1 uppercase">
                    Date <ArrowDownUp className="h-3 w-3" />
                  </button>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} onClick={() => setSelected(r.id)} className={cn("cursor-pointer transition-colors hover:bg-subtle", selected === r.id && "bg-brand-50/40")}>
                  <Td>
                    <PriorityBadge priority={r.priority} />
                  </Td>
                  <Td className="max-w-[260px]">
                    <div className="truncate font-medium text-ink">{r.title}</div>
                    <div className="mt-0.5">
                      <TypeBadge type={r.type} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-[11.5px] text-muted">{r.sku ?? "—"}</Td>
                  <Td className="max-w-[280px] text-[12.5px]">
                    <span className="line-clamp-2">{r.issue}</span>
                  </Td>
                  <Td className="max-w-[260px] text-[12.5px] font-medium text-ink">
                    <span className="line-clamp-2">{r.recommendation}</span>
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    <div className="font-medium text-ink">{fmtCurrency(r.impactValue)}</div>
                    <div className="text-[11px] text-muted">{r.impactLabel.replace(/^\$[\d,]+\s*/, "")}</div>
                  </Td>
                  <Td>
                    <RecStatusBadge status={r.status} />
                  </Td>
                  <Td className="tabular whitespace-nowrap text-xs text-muted">{fmtDate(r.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <div className="flex items-center justify-between px-5 py-3 text-xs text-muted">
          <span>
            {filtered.length === 0 ? 0 : page * PAGE + 1}–{Math.min(filtered.length, (page + 1) * PAGE)} of {filtered.length} recommendations
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={buttonClass("secondary", "sm")} aria-label="Previous page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 tabular">
              {page + 1} / {pages}
            </span>
            <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className={buttonClass("secondary", "sm")} aria-label="Next page">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {sel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20" onClick={() => setSelected(null)} />
          <aside className="relative flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl animate-slide-in">
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={sel.priority} />
                  <TypeBadge type={sel.type} />
                  {sel.sku && <span className="font-mono text-[11px] text-muted">{sel.sku}</span>}
                </div>
                <h2 className="mt-2 text-lg font-semibold leading-snug text-ink">{sel.title}</h2>
                <p className="mt-1 text-[13px] text-muted">{sel.issue}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded p-1 text-muted hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="rounded-lg bg-brand-50/60 p-4 ring-1 ring-brand-100">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Recommended action</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">{sel.recommendation}</div>
                <div className="mt-1 text-[13px] text-ink-2">{sel.impactLabel}</div>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {sel.facts.map((f) => (
                  <div key={f.label} className="rounded-lg border border-line px-3 py-2.5">
                    <dt className="text-[11px] text-muted">{f.label}</dt>
                    <dd className="tabular mt-0.5 text-sm font-semibold text-ink">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Why</h3>
                <ul className="mt-2 space-y-2">
                  {sel.reasoning.map((r, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] text-ink-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-muted">{i + 1}</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <StatusActions key={sel.id} id={sel.id} status={sel.status} canEdit={canEdit} onChange={(s) => updateStatus(sel.id, s)} />
            </div>
            <div className="border-t border-line px-6 py-3">
              <Link href={`/recommendations/${sel.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline">
                Open full details <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
