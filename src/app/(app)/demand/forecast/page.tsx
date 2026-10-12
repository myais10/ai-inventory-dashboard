import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { aggregateDemandSeries, categoryDemand, demandMovers } from "@/lib/demand";
import { Card, CardHeader, PageHeader, Table, Td, Th, TrendPill } from "@/components/ui";
import { DemandTabs } from "@/components/app/demand-tabs";
import { RiskBadge, TrendIndicator } from "@/components/app/badges";
import { ForecastChart } from "@/components/charts/charts";
import { cn, fmtCurrency, fmtDate, sum } from "@/lib/utils";

export const metadata: Metadata = { title: "Demand Forecast" };

export default async function DemandForecastPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const productCategory = new Map(ws.dataset.products.map((p) => [p.id, p.category]));
  const series = aggregateDemandSeries(ws.dataset, category ? (id) => productCategory.get(id) === category : undefined);
  const cats = categoryDemand(ws.dataset, ws.metrics);
  const actual = series.filter((s) => s.actual !== undefined);
  const future = series.filter((s) => s.actual === undefined);
  const last4 = sum(actual.slice(-4).map((s) => s.actual!));
  const next4 = sum(future.slice(0, 4).map((s) => s.forecast!));
  const next12 = sum(future.map((s) => s.forecast!));
  const shortages = demandMovers(ws.metrics).shortageRisk;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Demand" description="Forecast demand at cost across your catalog, by category and product." />
      <DemandTabs active="/demand/forecast" />

      <Card>
        <CardHeader
          title={`Demand forecast${category ? ` — ${category}` : " — all categories"}`}
          description="Weekly demand valued at cost · 52 weeks history · 12 week forecast with confidence band"
        />
        <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
          <Link href="/demand/forecast" className={cn("rounded-full px-2.5 py-1 text-xs font-medium", !category ? "bg-ink text-white" : "bg-slate-100 text-ink-2 hover:bg-slate-200")}>
            All
          </Link>
          {cats.map((c) => (
            <Link
              key={c.category}
              href={`/demand/forecast?category=${encodeURIComponent(c.category)}`}
              className={cn("rounded-full px-2.5 py-1 text-xs font-medium", category === c.category ? "bg-ink text-white" : "bg-slate-100 text-ink-2 hover:bg-slate-200")}
            >
              {c.category}
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          {[
            ["Last 4 weeks (actual)", fmtCurrency(last4)],
            ["Next 4 weeks (forecast)", fmtCurrency(next4)],
            ["Next 12 weeks (forecast)", fmtCurrency(next12)],
          ].map(([l, v], i) => (
            <div key={l} className="px-5 py-3">
              <div className="text-xs text-muted">{l}</div>
              <div className="tabular mt-0.5 flex items-baseline gap-2 text-lg font-semibold text-ink">
                {v}
                {i === 1 && last4 > 0 && <TrendPill pct={next4 / last4 - 1} />}
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-4">
          <ForecastChart data={series} height={300} currency />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Forecast by category" description="Weekly demand at cost" />
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th align="right">Prior 13 wk</Th>
                <Th align="right">Last 13 wk</Th>
                <Th align="right">Change</Th>
                <Th align="right">Forecast / wk</Th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.category} className="hover:bg-subtle">
                  <Td className="font-medium text-ink">
                    <Link href={`/demand/forecast?category=${encodeURIComponent(c.category)}`} className="hover:text-brand-600">
                      {c.category}
                    </Link>
                  </Td>
                  <Td align="right">{fmtCurrency(c.priorWeeklyValue)}</Td>
                  <Td align="right">{fmtCurrency(c.weeklyValue)}</Td>
                  <Td align="right"><TrendPill pct={c.changePct} /></Td>
                  <Td align="right" className="font-medium text-ink">{fmtCurrency(c.forecastWeeklyValue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Products likely to experience shortages" description="Rising demand combined with insufficient stock or inbound supply" />
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Trend</Th>
                <Th>Stockout</Th>
                <Th>Risk</Th>
              </tr>
            </thead>
            <tbody>
              {shortages.map((m) => (
                <tr key={m.product.id} className="hover:bg-subtle">
                  <Td className="max-w-[240px]">
                    <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                      {m.product.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted">{m.product.sku}</span>
                  </Td>
                  <Td><TrendIndicator trend={m.demandTrend} pct={m.demandChangePct} /></Td>
                  <Td className="tabular whitespace-nowrap">{fmtDate(m.projectedStockoutDate)}</Td>
                  <Td><RiskBadge risk={m.stockoutRisk} /></Td>
                </tr>
              ))}
              {shortages.length === 0 && (
                <tr>
                  <Td colSpan={4} className="py-8 text-center text-muted">No growing products are short of stock.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
