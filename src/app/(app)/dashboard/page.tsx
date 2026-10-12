import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, Boxes, PackageX, SearchX, ShoppingCart, Sparkles, TrendingDown, TrendingUp, Truck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui";
import { ActionCard } from "@/components/app/action-card";
import { StockStatusBadge, TrendIndicator } from "@/components/app/badges";
import { Sparkline, StackedBar } from "@/components/charts/sparkline";
import { demandMovers } from "@/lib/demand";
import { STATUS_META, salesHistoryByProduct } from "@/lib/inventory";
import { reliabilityLabel } from "@/lib/suppliers";
import { cn, fmtCompactCurrency, fmtCurrency, fmtDate, fmtNumber, fmtPct, parseISODate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(tz: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Kpi({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "slate" | "amber" | "red" | "violet" | "orange";
}) {
  const toneCls = {
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    violet: "bg-violet-50 text-violet-600",
    orange: "bg-orange-50 text-orange-600",
  }[tone];
  return (
    <Link href={href} className="group rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:border-line-strong hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="tabular mt-2 text-[26px] font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const { kpis, health, metrics } = ws;
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(parseISODate(ws.dataset.asOf));

  const open = ws.recommendations.filter((r) => r.status === "new" || r.status === "in_review");
  // Action Required: highest-impact high-priority actions, diversified across types.
  const actions = [
    ...open.filter((r) => r.type === "stockout_risk").slice(0, 3),
    ...open.filter((r) => r.type === "reorder" && r.priority === "high").slice(0, 1),
    ...open.filter((r) => r.type === "lost_demand" && r.priority === "high").slice(0, 1),
    ...open.filter((r) => r.type === "excess_stock" || r.type === "slow_stock").sort((a, b) => b.impactValue - a.impactValue).slice(0, 1),
  ];
  const highCount = open.filter((r) => r.priority === "high").length;

  const stockouts = metrics.filter((m) => m.stockoutRisk === "high" || m.stockoutRisk === "medium").sort((a, b) => (a.daysUntilStockout ?? 99) - (b.daysUntilStockout ?? 99));
  const excess = metrics
    .filter((m) => m.status === "excess" || m.status === "slow" || m.status === "dead")
    .map((m) => ({ m, value: m.status === "excess" ? m.excessValue : m.inventoryValue }))
    .sort((a, b) => b.value - a.value);
  const movers = demandMovers(metrics);
  const history = salesHistoryByProduct(ws.dataset);
  const supplierIssues = ws.suppliers.filter((s) => s.onTimeRate < 0.8 || s.delayedPos > 0 || s.priceChangePct > 0.05).sort((a, b) => a.onTimeRate - b.onTimeRate);
  const lost = ws.lostDemand.filter((l) => !l.stocked);

  const statusOrder = ["healthy", "reorder", "critical", "at_risk", "excess", "slow", "dead"] as const;
  const statusColor: Record<string, string> = {
    healthy: "bg-emerald-500",
    reorder: "bg-amber-400",
    critical: "bg-red-500",
    at_risk: "bg-orange-400",
    excess: "bg-violet-400",
    slow: "bg-sky-400",
    dead: "bg-slate-400",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-muted">{today}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {greeting(ws.dataset.company.timezone || "America/Chicago")}, {session.user.firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Here&apos;s what needs your attention today.{" "}
            <span className="text-ink-2">
              {highCount} high-priority actions · {fmtCompactCurrency(kpis.recommendedPurchasing)} recommended purchasing
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports/weekly-inventory" className="inline-flex h-9 items-center rounded-lg bg-white px-3.5 text-sm font-medium text-ink-2 ring-1 ring-inset ring-line-strong hover:bg-subtle">
            Weekly report
          </Link>
          <Link href="/recommendations" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700">
            All recommendations <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Total Inventory" value={fmtCompactCurrency(kpis.totalInventory)} sub={`${fmtNumber(health.skuCount)} SKUs · ${health.turnover.toFixed(1)}× annual turns`} href="/inventory/health" icon={Boxes} tone="slate" />
        <Kpi label="Reorder Required" value={String(kpis.reorderRequired)} sub={`${fmtCompactCurrency(kpis.recommendedPurchasing)} to purchase`} href="/recommendations/reorder" icon={ShoppingCart} tone="amber" />
        <Kpi label="Stockout Risks" value={String(kpis.stockoutRisks)} sub={`Before replenishment · +${kpis.stockoutWatch} on watch`} href="/recommendations/stockout-risk" icon={AlertTriangle} tone="red" />
        <Kpi label="Excess Inventory" value={fmtCompactCurrency(kpis.excessInventory)} sub={`${fmtPct(kpis.excessInventory / (kpis.totalInventory || 1))} of inventory value`} href="/recommendations/excess" icon={PackageX} tone="violet" />
        <Kpi label="Lost Demand" value={fmtCompactCurrency(kpis.lostDemand)} sub={`${lost.length} unstocked items requested · 12 mo`} href="/recommendations/lost-demand" icon={SearchX} tone="orange" />
      </div>

      {/* Action required + health */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">Action required</h2>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{highCount} high priority</span>
            </div>
            <Link href="/recommendations?priority=high" className="text-xs font-medium text-brand-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {actions.map((r) => (
              <ActionCard key={r.id} rec={r} />
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Inventory health" description={`${fmtPct(health.healthyPct)} of SKUs healthy`} actions={<Link href="/inventory/health" className="text-xs text-brand-600 hover:underline">Details</Link>} />
            <div className="p-5">
              <StackedBar segments={statusOrder.map((s) => ({ value: health.byStatus[s].value, className: statusColor[s], label: STATUS_META[s].label }))} />
              <ul className="mt-4 space-y-2">
                {statusOrder.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-[13px]">
                    <span className={cn("h-2 w-2 rounded-sm", statusColor[s])} />
                    <span className="flex-1 text-ink-2">{STATUS_META[s].label}</span>
                    <span className="tabular w-8 text-right text-muted">{health.byStatus[s].count}</span>
                    <span className="tabular w-16 text-right font-medium text-ink">{fmtCompactCurrency(health.byStatus[s].value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recommended purchasing" description="By supplier, at cost" />
            <ul className="divide-y divide-line/70">
              {Object.values(
                metrics
                  .filter((m) => m.needsReorder)
                  .reduce<Record<string, { name: string; value: number; skus: number }>>((acc, m) => {
                    const k = m.supplier.id;
                    acc[k] ??= { name: m.supplier.name, value: 0, skus: 0 };
                    acc[k].value += m.recommendedOrderValue;
                    acc[k].skus += 1;
                    return acc;
                  }, {}),
              )
                .sort((a, b) => b.value - a.value)
                .slice(0, 6)
                .map((s) => (
                  <li key={s.name} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{s.name}</span>
                      <span className="text-xs text-muted">{s.skus} SKU{s.skus > 1 ? "s" : ""}</span>
                    </span>
                    <span className="tabular font-medium text-ink">{fmtCurrency(s.value)}</span>
                  </li>
                ))}
            </ul>
          </Card>
        </aside>
      </div>

      {/* Stockout + Excess */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Stockout risks"
            description="Projected to run out before or shortly after replenishment"
            actions={<Link href="/recommendations/stockout-risk" className="text-xs text-brand-600 hover:underline">View all</Link>}
          />
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th align="right">Stock</Th>
                <Th align="right">Days</Th>
                <Th align="right">Lead time</Th>
                <Th>Stockout</Th>
              </tr>
            </thead>
            <tbody>
              {stockouts.slice(0, 7).map((m) => (
                <tr key={m.product.id} className="hover:bg-subtle">
                  <Td className="max-w-[240px]">
                    <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                      {m.product.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted">{m.product.sku}</span>
                  </Td>
                  <Td align="right">{fmtNumber(m.available)}</Td>
                  <Td align="right" className="font-medium text-ink">{fmtNumber(m.daysOfStock, 1)}</Td>
                  <Td align="right">{m.effectiveLeadTimeDays}d</Td>
                  <Td className={cn("tabular whitespace-nowrap font-medium", m.stockoutRisk === "high" ? "text-red-600" : "text-orange-600")}>{fmtDate(m.projectedStockoutDate)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader
            icon={<PackageX className="h-4 w-4" />}
            title="Excess & slow stock"
            description={`${fmtCurrency(excess.reduce((a, b) => a + b.value, 0))} of capital that could be released`}
            actions={<Link href="/recommendations/excess" className="text-xs text-brand-600 hover:underline">View all</Link>}
          />
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th align="right">Last sale</Th>
                <Th align="right">Tied up</Th>
              </tr>
            </thead>
            <tbody>
              {excess.slice(0, 7).map(({ m, value }) => (
                <tr key={m.product.id} className="hover:bg-subtle">
                  <Td className="max-w-[240px]">
                    <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                      {m.product.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted">{m.product.sku}</span>
                  </Td>
                  <Td><StockStatusBadge status={m.status} /></Td>
                  <Td align="right">{m.daysSinceLastSale === null ? "Never" : `${m.daysSinceLastSale}d ago`}</Td>
                  <Td align="right" className="font-medium text-ink">{fmtCurrency(value)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* Demand / Lost / Suppliers */}
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader icon={<TrendingUp className="h-4 w-4" />} title="Demand changes" description="Last 13 weeks vs prior 13 weeks" actions={<Link href="/demand/trends" className="text-xs text-brand-600 hover:underline">Trends</Link>} />
          <div className="grid grid-cols-1 divide-y divide-line/70">
            {[...movers.increasing.slice(0, 4), ...movers.declining.slice(0, 2)].map((m) => (
              <Link key={m.product.id} href={`/products/${encodeURIComponent(m.product.sku)}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{m.product.name}</span>
                  <span className="text-xs text-muted">{fmtNumber(m.velocityPrior13, 1)} → {fmtNumber(m.velocity13, 1)} /wk</span>
                </span>
                <Sparkline values={(history.get(m.product.id) ?? []).slice(-26)} className={m.demandTrend === "increasing" ? "text-emerald-500" : "text-red-500"} />
                <span className="w-12 text-right">
                  <TrendIndicator trend={m.demandTrend} pct={m.demandChangePct} />
                </span>
              </Link>
            ))}
          </div>
          {movers.spikes.length > 0 && (
            <div className="border-t border-line bg-sky-50/50 px-5 py-2.5 text-xs text-sky-800">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Demand spike detected last week: {movers.spikes.map((m) => m.product.sku).join(", ")}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader icon={<SearchX className="h-4 w-4" />} title="Lost demand" description="Requested by customers, not stocked" actions={<Link href="/recommendations/lost-demand" className="text-xs text-brand-600 hover:underline">View all</Link>} />
          <ul className="divide-y divide-line/70">
            {lost.slice(0, 6).map((l) => (
              <li key={l.itemKey} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{l.item}</span>
                  <span className="text-xs text-muted">
                    {l.requests} requests · {l.customers} customers
                  </span>
                </span>
                <TrendIndicator trend={l.trend} />
                <span className="tabular w-16 text-right text-[13px] font-medium text-ink">{fmtCompactCurrency(l.estimatedLostSales)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader icon={<Truck className="h-4 w-4" />} title="Supplier issues" description="Reliability, delays and cost changes" actions={<Link href="/suppliers/performance" className="text-xs text-brand-600 hover:underline">Performance</Link>} />
          <ul className="divide-y divide-line/70">
            {supplierIssues.slice(0, 6).map((s) => {
              const rel = reliabilityLabel(s.onTimeRate);
              return (
                <li key={s.supplier.id}>
                  <Link href={`/suppliers/${s.supplier.code.toLowerCase()}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{s.supplier.name}</span>
                      <span className="text-xs text-muted">
                        {fmtNumber(s.avgLeadTimeDays, 1)}d actual vs {s.quotedLeadTimeDays}d quoted
                        {s.delayedPos ? ` · ${s.delayedPos} overdue PO` : ""}
                        {s.priceChangePct > 0.05 ? ` · cost ${fmtPct(s.priceChangePct, 1, true)}` : ""}
                      </span>
                    </span>
                    <span className={cn("tabular text-[13px] font-semibold", rel.tone === "bad" ? "text-red-600" : rel.tone === "warn" ? "text-amber-600" : "text-emerald-600")}>
                      {fmtPct(s.onTimeRate)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-faint">
          <TrendingDown className="h-3 w-3" /> Calculations as of {fmtDate(ws.dataset.asOf, true)} · demand forecasts use exponential smoothing with seasonality detection · numbers are computed deterministically, not by AI.
      </p>
    </div>
  );
}
