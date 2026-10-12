"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, X } from "lucide-react";
import { Card, Table, Td, Th, buttonClass } from "@/components/ui";
import { cn, fmtCurrency, fmtDate, fmtNumber } from "@/lib/utils";

export interface ReorderRow {
  productId: string;
  sku: string;
  name: string;
  supplier: string;
  warehouse: string;
  onHand: number;
  onOrder: number;
  weekly: number;
  leadTime: number;
  reorderPoint: number;
  safetyStock: number;
  qty: number;
  moq: number;
  unitCost: number;
  stockoutDate?: string;
  risk: "high" | "medium" | "low" | "none";
  recId?: string;
}

export function ReorderPlanner({ rows, canEdit }: { rows: ReorderRow[]; canEdit: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.filter((r) => r.risk === "high" || r.risk === "medium").map((r) => r.productId)));
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(rows.map((r) => [r.productId, r.qty])));
  const [supplier, setSupplier] = useState("");
  const [modal, setModal] = useState(false);
  const [created, setCreated] = useState(false);

  const suppliers = [...new Set(rows.map((r) => r.supplier))].sort();
  const visible = rows.filter((r) => !supplier || r.supplier === supplier);
  const chosen = rows.filter((r) => selected.has(r.productId));
  const total = chosen.reduce((a, r) => a + (qty[r.productId] ?? 0) * r.unitCost, 0);

  const bySupplier = useMemo(() => {
    const g = new Map<string, ReorderRow[]>();
    for (const r of chosen) g.set(r.supplier, [...(g.get(r.supplier) ?? []), r]);
    return [...g.entries()];
  }, [chosen]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const download = () => {
    const lines = ["Supplier,SKU,Product,Quantity,Unit cost,Line total"];
    for (const [s, rs] of bySupplier) for (const r of rs) lines.push([s, r.sku, r.name, qty[r.productId], r.unitCost, (qty[r.productId] * r.unitCost).toFixed(2)].map((v) => `"${v}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "purchase-order-drafts.csv";
    a.click();
  };

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-8 rounded-md border border-line-strong bg-white px-2 text-[13px] text-ink-2" aria-label="Supplier">
            <option value="">Supplier: All</option>
            {suppliers.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="text-[13px] text-muted sm:ml-auto">
            <span className="font-medium text-ink">{chosen.length}</span> selected · <span className="tabular font-semibold text-ink">{fmtCurrency(total)}</span>
          </div>
          <button type="button" disabled={!chosen.length || !canEdit} onClick={() => setModal(true)} className={buttonClass("primary", "sm")} title={canEdit ? undefined : "View-only access"}>
            <FileText className="h-3.5 w-3.5" /> Create PO drafts
          </button>
        </div>
        <Table>
          <thead>
            <tr>
              <Th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={visible.length > 0 && visible.every((r) => selected.has(r.productId))}
                  onChange={(e) => setSelected((s) => { const n = new Set(s); visible.forEach((r) => (e.target.checked ? n.add(r.productId) : n.delete(r.productId))); return n; })}
                />
              </Th>
              <Th>Product</Th>
              <Th>Supplier</Th>
              <Th align="right">On hand</Th>
              <Th align="right">On order</Th>
              <Th align="right">Weekly demand</Th>
              <Th align="right">Lead time</Th>
              <Th align="right">Reorder pt</Th>
              <Th>Stockout</Th>
              <Th align="right">Order qty</Th>
              <Th align="right">Value</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.productId} className={cn("hover:bg-subtle", selected.has(r.productId) && "bg-brand-50/30")}>
                <Td>
                  <input type="checkbox" aria-label={`Select ${r.sku}`} checked={selected.has(r.productId)} onChange={() => toggle(r.productId)} />
                </Td>
                <Td className="max-w-[260px]">
                  <Link href={`/products/${encodeURIComponent(r.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                    {r.name}
                  </Link>
                  <span className="font-mono text-[11px] text-muted">{r.sku}</span>
                </Td>
                <Td className="whitespace-nowrap text-[12.5px]">{r.supplier}</Td>
                <Td align="right">{fmtNumber(r.onHand)}</Td>
                <Td align="right">{r.onOrder ? fmtNumber(r.onOrder) : "—"}</Td>
                <Td align="right">{fmtNumber(r.weekly, 1)}</Td>
                <Td align="right">{r.leadTime}d</Td>
                <Td align="right">{fmtNumber(r.reorderPoint)}</Td>
                <Td className={cn("tabular whitespace-nowrap", r.risk === "high" ? "font-medium text-red-600" : r.risk === "medium" ? "font-medium text-orange-600" : "text-muted")}>
                  {r.stockoutDate ? fmtDate(r.stockoutDate) : "—"}
                </Td>
                <Td align="right">
                  <input
                    type="number"
                    min={0}
                    step={r.moq}
                    value={qty[r.productId]}
                    disabled={!canEdit}
                    onChange={(e) => setQty((q) => ({ ...q, [r.productId]: Math.max(0, Number(e.target.value) || 0) }))}
                    className="tabular h-7 w-20 rounded border border-line-strong px-2 text-right text-[13px] font-medium text-ink outline-none focus:border-brand-500"
                    aria-label={`Order quantity for ${r.sku}`}
                  />
                  <div className="mt-0.5 text-[10.5px] text-faint">MOQ {r.moq}</div>
                </Td>
                <Td align="right" className="font-medium text-ink">{fmtCurrency((qty[r.productId] ?? 0) * r.unitCost)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h2 className="text-base font-semibold">Purchase order drafts</h2>
                <p className="text-xs text-muted">{bySupplier.length} suppliers · {fmtCurrency(total)} total</p>
              </div>
              <button type="button" onClick={() => { setModal(false); setCreated(false); }} className="rounded p-1 text-muted hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-4">
              {created && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-4 w-4" /> Drafts created. Push to your ERP once an integration is connected, or download as CSV.
                </div>
              )}
              {bySupplier.map(([s, rs]) => (
                <div key={s} className="rounded-lg border border-line">
                  <div className="flex items-center justify-between border-b border-line bg-subtle px-4 py-2 text-[13px]">
                    <span className="font-semibold text-ink">{s}</span>
                    <span className="tabular font-medium">{fmtCurrency(rs.reduce((a, r) => a + qty[r.productId] * r.unitCost, 0))}</span>
                  </div>
                  <ul className="divide-y divide-line/70 text-[13px]">
                    {rs.map((r) => (
                      <li key={r.productId} className="flex justify-between gap-3 px-4 py-2">
                        <span className="truncate">{r.name}</span>
                        <span className="tabular shrink-0 text-muted">
                          {fmtNumber(qty[r.productId])} × {fmtCurrency(r.unitCost, true)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
              <button type="button" onClick={download} className={buttonClass("secondary")}>
                <Download className="h-4 w-4" /> Download CSV
              </button>
              <button type="button" onClick={() => setCreated(true)} disabled={created} className={buttonClass("primary")}>
                {created ? "Drafts created" : "Create drafts"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
