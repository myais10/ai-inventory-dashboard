import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Card, CardHeader, LinkTabs, PageHeader, ProgressBar, Table, Td, Th } from "@/components/ui";
import { StackedBar } from "@/components/charts/sparkline";
import { STATUS_META } from "@/lib/inventory";
import type { StockStatus } from "@/lib/types";
import { cn, fmtCompactCurrency, fmtCurrency, fmtPct } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventory Health" };

const COLORS: Record<StockStatus, string> = {
  healthy: "bg-emerald-500",
  reorder: "bg-amber-400",
  critical: "bg-red-500",
  at_risk: "bg-orange-400",
  excess: "bg-violet-400",
  slow: "bg-sky-400",
  dead: "bg-slate-400",
};

export default async function InventoryHealthPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const h = ws.health;
  const score = Math.round(
    100 * (1 - (h.excessValue / (h.totalValue || 1)) * 0.6 - ((h.stockoutHigh + h.stockoutMedium * 0.5) / (h.skuCount || 1)) * 1.2 - ((h.byStatus.dead.count + h.byStatus.slow.count) / (h.skuCount || 1)) * 0.5),
  );
  const unmet = ws.kpis.lostDemand;

  const tiles: { label: string; value: string; sub: string; href: string; tone?: string }[] = [
    { label: "Total inventory", value: fmtCompactCurrency(h.totalValue), sub: `${h.skuCount} SKUs · ${h.turnover.toFixed(1)}× turns`, href: "/inventory" },
    { label: "Excess inventory", value: fmtCompactCurrency(h.excessValue), sub: `${fmtPct(h.excessValue / (h.totalValue || 1))} of value`, href: "/recommendations/excess", tone: "text-violet-700" },
    { label: "Stockout risks", value: String(h.stockoutHigh + h.stockoutMedium), sub: `${h.stockoutHigh} high · ${h.stockoutMedium} medium`, href: "/recommendations/stockout-risk", tone: "text-red-600" },
    { label: "Increasing demand", value: String(h.increasingDemand), sub: `${h.decliningDemand} SKUs declining`, href: "/demand/trends", tone: "text-emerald-700" },
    { label: "Unmet demand", value: fmtCompactCurrency(unmet), sub: "Lost sales, last 12 months", href: "/recommendations/lost-demand", tone: "text-orange-700" },
    { label: "Recommended purchasing", value: fmtCompactCurrency(h.reorderValue), sub: `${h.reorderCount} SKUs to reorder`, href: "/recommendations/reorder", tone: "text-brand-700" },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Inventory health" description="A management view of where your inventory capital sits and where the risks are." />
      <LinkTabs active="/inventory/health" tabs={[{ href: "/inventory", label: "All Products" }, { href: "/inventory/health", label: "Inventory Health" }]} />

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Health score</div>
          <div className="relative mt-4 h-36 w-36">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#eef0f3" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke={score >= 75 ? "#10b981" : score >= 55 ? "#f59e0b" : "#ef4444"}
                strokeWidth="3"
                strokeDasharray={`${Math.max(0, score)} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular text-4xl font-semibold text-ink">{score}</span>
              <span className="text-xs text-muted">/ 100</span>
            </div>
          </div>
          <p className="mt-4 text-[13px] text-muted">Weighted by excess capital, stockout exposure and non-moving stock.</p>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="rounded-xl border border-line bg-white p-4 transition hover:border-line-strong hover:shadow-sm">
              <div className="text-[13px] text-muted">{t.label}</div>
              <div className={cn("tabular mt-1.5 text-2xl font-semibold text-ink", t.tone)}>{t.value}</div>
              <div className="mt-1 text-xs text-muted">{t.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Inventory value by status" />
        <div className="p-5">
          <StackedBar className="h-4" segments={(Object.keys(COLORS) as StockStatus[]).map((s) => ({ value: h.byStatus[s].value, className: COLORS[s], label: STATUS_META[s].label }))} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {(Object.keys(COLORS) as StockStatus[]).filter((s) => h.byStatus[s].count > 0).map((s) => (
              <Link key={s} href={`/inventory?status=${s}`} className="rounded-lg border border-line px-3 py-2 hover:bg-subtle">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span className={cn("h-2 w-2 rounded-sm", COLORS[s])} /> {STATUS_META[s].label}
                </div>
                <div className="tabular mt-1 text-sm font-semibold text-ink">{fmtCompactCurrency(h.byStatus[s].value)}</div>
                <div className="text-[11px] text-faint">{h.byStatus[s].count} SKUs</div>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="By category" />
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th align="right">SKUs</Th>
                <Th align="right">Value</Th>
                <Th>Share</Th>
                <Th align="right">Excess</Th>
                <Th align="right">At risk</Th>
              </tr>
            </thead>
            <tbody>
              {h.byCategory.map((c) => (
                <tr key={c.category}>
                  <Td className="font-medium text-ink">{c.category}</Td>
                  <Td align="right">{c.skus}</Td>
                  <Td align="right" className="font-medium text-ink">{fmtCurrency(c.value)}</Td>
                  <Td className="w-40">
                    <ProgressBar value={c.value / (h.totalValue || 1)} />
                  </Td>
                  <Td align="right" className={cn(c.excessValue > 0 && "text-violet-700")}>{c.excessValue ? fmtCurrency(c.excessValue) : "—"}</Td>
                  <Td align="right" className={cn(c.atRisk > 0 && "font-semibold text-red-600")}>{c.atRisk || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="By warehouse" />
          <Table>
            <thead>
              <tr>
                <Th>Warehouse</Th>
                <Th align="right">SKUs</Th>
                <Th align="right">Value</Th>
                <Th align="right">At risk</Th>
              </tr>
            </thead>
            <tbody>
              {h.byWarehouse.map((w) => (
                <tr key={w.warehouseId}>
                  <Td className="font-medium text-ink">{w.name}</Td>
                  <Td align="right">{w.skus}</Td>
                  <Td align="right" className="font-medium text-ink">{fmtCurrency(w.value)}</Td>
                  <Td align="right" className={cn(w.atRisk > 0 && "font-semibold text-red-600")}>{w.atRisk || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
