import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { RecommendationTabs } from "@/components/app/rec-tabs";
import { RiskBadge, TrendIndicator } from "@/components/app/badges";
import { cn, daysBetween, fmtCurrency, fmtDate, fmtNumber } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Stockout Risk" };

export default async function StockoutRiskPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const list = ws.metrics
    .filter((m) => m.stockoutRisk === "high" || m.stockoutRisk === "medium")
    .sort((a, b) => (a.daysUntilStockout ?? 99) - (b.daysUntilStockout ?? 99));
  const recByProduct = new Map(ws.recommendations.filter((r) => r.productId).map((r) => [r.productId!, r]));
  const revenueAtRisk = list.reduce((a, m) => {
    const r = recByProduct.get(m.product.id);
    return a + (r?.type === "stockout_risk" ? r.impactValue : 0);
  }, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Stockout risk"
        description="Products likely to run out before replenishment arrives, based on forecast demand, open purchase orders and actual supplier lead times."
      />
      <RecommendationTabs ws={ws} active="/recommendations/stockout-risk" />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-red-200 bg-red-50/60 px-4 py-3">
          <div className="text-xs text-red-700">High risk — can&apos;t be fixed by a normal order</div>
          <div className="tabular mt-1 text-2xl font-semibold text-red-700">{list.filter((m) => m.stockoutRisk === "high").length}</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50/60 px-4 py-3">
          <div className="text-xs text-orange-700">Medium risk — order now to avoid</div>
          <div className="tabular mt-1 text-2xl font-semibold text-orange-700">{list.filter((m) => m.stockoutRisk === "medium").length}</div>
        </div>
        <div className="rounded-lg border border-line bg-white px-4 py-3">
          <div className="text-xs text-muted">Revenue at risk (high-risk SKUs)</div>
          <div className="tabular mt-1 text-2xl font-semibold text-ink">{fmtCurrency(revenueAtRisk)}</div>
        </div>
      </div>
      <Card>
        <CardHeader title={`${list.length} products at risk`} description="Sorted by soonest expected stockout" />
        {list.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-4 w-4" />} title="No stockout risks" description="Every product has enough stock or inbound supply to cover lead time." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Risk</Th>
                <Th>Expected stockout</Th>
                <Th align="right">Current stock</Th>
                <Th align="right">Demand / wk</Th>
                <Th align="right">Days of stock</Th>
                <Th align="right">Lead time</Th>
                <Th>Next receipt</Th>
                <Th>Recommended action</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const rec = recByProduct.get(m.product.id);
                const days = m.projectedStockoutDate ? daysBetween(ws.dataset.asOf, m.projectedStockoutDate) : null;
                return (
                  <tr key={m.product.id} className="hover:bg-subtle">
                    <Td className="max-w-[260px]">
                      <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                        {m.product.name}
                      </Link>
                      <span className="font-mono text-[11px] text-muted">{m.product.sku}</span> <span className="text-[11px] text-faint">· {m.supplier.name}</span>
                    </Td>
                    <Td><RiskBadge risk={m.stockoutRisk} /></Td>
                    <Td className="whitespace-nowrap">
                      <div className={cn("tabular font-semibold", m.stockoutRisk === "high" ? "text-red-600" : "text-orange-600")}>{fmtDate(m.projectedStockoutDate)}</div>
                      <div className="text-[11px] text-muted">in {days} days</div>
                    </Td>
                    <Td align="right">{fmtNumber(m.available)}</Td>
                    <Td align="right">
                      {fmtNumber(m.forecastWeekly, 1)}
                      <div><TrendIndicator trend={m.demandTrend} pct={m.demandChangePct} /></div>
                    </Td>
                    <Td align="right" className="font-medium text-ink">{fmtNumber(m.daysOfStock, 1)}</Td>
                    <Td align="right">{m.effectiveLeadTimeDays}d</Td>
                    <Td className="whitespace-nowrap text-[12.5px]">{m.openPoQty ? `${fmtNumber(m.openPoQty)} · ${fmtDate(m.nextPoDate)}` : <span className="text-faint">None</span>}</Td>
                    <Td className="min-w-[220px] text-[12.5px]">
                      {rec ? (
                        <Link href={`/recommendations/${rec.id}`} className="font-medium text-brand-700 hover:underline">
                          {rec.recommendation}
                        </Link>
                      ) : (
                        "Monitor"
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
