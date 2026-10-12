import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getWorkspace } from "@/lib/data";
import { buildProjection } from "@/lib/inventory/projection";
import { productDemandSeries } from "@/lib/demand";
import { explainRecommendation } from "@/lib/ai/explain";
import { TYPE_META } from "@/lib/recommendations";
import { Card, CardHeader, Stat } from "@/components/ui";
import { PriorityBadge, RecStatusBadge, StockStatusBadge, TypeBadge } from "@/components/app/badges";
import { StatusActions } from "@/components/app/status-actions";
import { MonthlyBars, ProjectionChart, SalesBarsChart, SimpleLineChart } from "@/components/charts/charts";
import { addDays, fmtCurrency, fmtDate, fmtMonth, fmtNumber, fmtPct } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Recommendation ${(await params).id}` };
}

export default async function RecommendationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const rec = ws.recommendations.find((r) => r.id === decodeURIComponent(id));
  if (!rec) notFound();

  const m = rec.productId ? ws.metricsById.get(rec.productId) : undefined;
  const sup = rec.supplierId ? ws.suppliers.find((s) => s.supplier.id === rec.supplierId) : undefined;
  const lost = rec.itemKey ? ws.lostDemand.find((l) => l.itemKey === rec.itemKey) : undefined;

  return (
    <div className="animate-fade-in">
      <Link href="/recommendations" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Recommendations
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={rec.priority} />
            <TypeBadge type={rec.type} />
            {rec.sku && <span className="font-mono text-xs text-muted">{rec.sku}</span>}
            <span className="text-xs text-faint">· Created {fmtDate(rec.createdAt, true)}</span>
            <RecStatusBadge status={rec.status} />
          </div>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{rec.title}</h1>
          <p className="mt-1 text-sm text-muted">{rec.issue}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-brand-100 bg-brand-50/60 px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Recommended action</div>
              <div className="mt-1 text-lg font-semibold text-ink">{rec.recommendation}</div>
              <div className="mt-0.5 text-sm text-ink-2">Expected impact: {rec.impactLabel}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
              {rec.facts.map((f) => (
                <Stat key={f.label} label={f.label} value={f.value} />
              ))}
            </div>
            <div className="border-t border-line px-5 py-4">
              <StatusActions id={rec.id} status={rec.status} canEdit={can(session.role, "recommendations:update")} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Why we recommend this" description="Deterministic calculation steps" />
            <ol className="space-y-3 px-5 py-4">
              {rec.reasoning.map((r, i) => (
                <li key={i} className="flex gap-3 text-[13.5px] text-ink-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-muted">{i + 1}</span>
                  {r}
                </li>
              ))}
            </ol>
            <div className="mx-5 mb-5 rounded-lg border border-dashed border-brand-200 bg-brand-50/30 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                <Sparkles className="h-3 w-3" /> Summary
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{explainRecommendation(rec)}</p>
              <p className="mt-1.5 text-[11px] text-faint">Written from the calculated figures above — the explanation layer never changes quantities.</p>
            </div>
          </Card>

          {m && (
            <Card>
              <CardHeader title="Projected stock — next 8 weeks" description="Forecast demand consumed daily; open purchase orders received on their expected date" />
              <div className="px-3 py-4">
                <ProjectionChart data={buildProjection(ws.dataset, m)} />
              </div>
            </Card>
          )}
          {m && (
            <Card>
              <CardHeader title="Weekly sales & forecast" description="Last 26 weeks of units sold, next 8 weeks forecast" />
              <div className="px-3 py-4">
                <SalesBarsChart data={productDemandSeries(ws.dataset, m.product.id).slice(-34)} />
              </div>
            </Card>
          )}
          {sup && (
            <Card>
              <CardHeader title="Actual lead time — last 6 months" description={`Quoted: ${sup.quotedLeadTimeDays} days`} />
              <div className="px-3 py-4">
                <SimpleLineChart data={sup.leadTimeHistory} dataKey="days" suffix="d" />
              </div>
            </Card>
          )}
          {lost && (
            <Card>
              <CardHeader title="Requests per month" description="Last 12 months of customer enquiries" />
              <div className="px-3 py-4">
                <MonthlyBars data={lost.monthly.map((v, i) => ({ month: fmtMonth(addDays(ws.dataset.asOf, -30 * (11 - i))), value: v }))} />
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {m && (
            <Card>
              <CardHeader title="Product" actions={<Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="text-xs text-brand-600 hover:underline">Open product</Link>} />
              <dl className="divide-y divide-line/70 text-[13px]">
                {[
                  ["Status", <StockStatusBadge key="s" status={m.status} />],
                  ["Category", m.product.category],
                  ["Warehouse", m.warehouse.name],
                  ["Supplier", m.supplier.name],
                  ["On hand / available", `${fmtNumber(m.onHand)} / ${fmtNumber(m.available)}`],
                  ["On order", m.openPoQty ? `${fmtNumber(m.openPoQty)} (${m.nextPoNumber})` : "—"],
                  ["Forecast demand", `${fmtNumber(m.forecastWeekly, 1)} / week`],
                  ["Safety stock", fmtNumber(m.safetyStock)],
                  ["Reorder point", fmtNumber(m.reorderPoint)],
                  ["MOQ", fmtNumber(m.product.moq)],
                  ["Unit cost", fmtCurrency(m.product.unitCost, true)],
                  ["Inventory value", fmtCurrency(m.inventoryValue)],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex items-center justify-between gap-3 px-5 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          {sup && (
            <Card>
              <CardHeader title="Supplier" actions={<Link href={`/suppliers/${sup.supplier.code.toLowerCase()}`} className="text-xs text-brand-600 hover:underline">Open supplier</Link>} />
              <dl className="divide-y divide-line/70 text-[13px]">
                {[
                  ["On-time delivery", fmtPct(sup.onTimeRate)],
                  ["Avg lead time", `${fmtNumber(sup.avgLeadTimeDays, 1)} days`],
                  ["Open POs", `${sup.openPos} (${sup.delayedPos} overdue)`],
                  ["12-mo spend", fmtCurrency(sup.spend12m)],
                  ["Cost change (6 mo)", fmtPct(sup.priceChangePct, 1, true)],
                  ["Dependency", sup.dependency],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-5 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular font-medium capitalize text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          <Card className="p-5 text-[12.5px] text-muted">
            <div className="font-medium text-ink">About {TYPE_META[rec.type].label.toLowerCase()} recommendations</div>
            <p className="mt-1">
              Recommendations are recalculated each time your data refreshes. Approving marks it for action by your purchasing team; dismissing hides it until the underlying numbers change materially.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
