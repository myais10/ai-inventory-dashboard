import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { buildProjection, reconstructHistory } from "@/lib/inventory/projection";
import { productDemandSeries } from "@/lib/demand";
import { forecastDemand } from "@/lib/forecasting";
import { salesHistoryByProduct } from "@/lib/inventory";
import { reliabilityLabel } from "@/lib/suppliers";
import { Badge, Card, CardHeader, Table, Td, Th } from "@/components/ui";
import { PriorityBadge, RiskBadge, StockStatusBadge, TrendIndicator, TypeBadge } from "@/components/app/badges";
import { ProjectionChart, SalesBarsChart, StockHistoryChart } from "@/components/charts/charts";
import { addDays, cn, daysBetween, fmtCurrency, fmtDate, fmtNumber, fmtPct } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ sku: string }> }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).sku) };
}

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const m = ws.metricsBySku.get(decodeURIComponent(sku).toLowerCase());
  if (!m) notFound();
  const p = m.product;
  const ds = ws.dataset;

  const recs = ws.recommendations.filter((r) => r.productId === p.id);
  const supplier = ws.suppliers.find((s) => s.supplier.id === p.supplierId);
  const pos = ds.purchaseOrders
    .filter((po) => po.lines.some((l) => l.productId === p.id))
    .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1))
    .slice(0, 8);
  const history = salesHistoryByProduct(ds).get(p.id) ?? [];
  const fc = forecastDemand(history, 8);
  const lastWeek = ds.salesWeeks.filter((s) => s.productId === p.id).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0]?.weekStart ?? ds.asOf;
  const price = ds.priceHistory.filter((x) => x.productId === p.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  const priceChange = price.length > 1 ? price[price.length - 1].unitCost / price[0].unitCost - 1 : 0;

  const kpis: [string, string, string?][] = [
    ["Current stock", `${fmtNumber(m.onHand)} ${p.uom}`, `${fmtNumber(m.available)} available`],
    ["Inventory value", fmtCurrency(m.inventoryValue), `${fmtCurrency(p.unitCost, true)} unit cost`],
    ["Weekly sales", fmtNumber(m.weeklyVelocity, 1), `Forecast ${fmtNumber(m.forecastWeekly, 1)}/wk`],
    ["Days of stock", fmtNumber(m.daysOfStock, 1), m.projectedStockoutDate ? `Out ${fmtDate(m.projectedStockoutDate)}` : "No stockout projected"],
    ["Supplier lead time", `${m.effectiveLeadTimeDays} days`, `Quoted ${p.leadTimeDays} days`],
    ["Open PO", fmtNumber(m.openPoQty), m.nextPoDate ? `Due ${fmtDate(m.nextPoDate)}` : "None open"],
    ["Safety stock", fmtNumber(m.safetyStock), `Reorder point ${fmtNumber(m.reorderPoint)}`],
    ["MOQ", fmtNumber(p.moq), `Order multiple ${p.orderMultiple}`],
  ];

  return (
    <div className="animate-fade-in">
      <Link href="/inventory" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> All products
      </Link>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StockStatusBadge status={m.status} />
            {m.isSeasonal && <Badge tone="blue">Seasonal</Badge>}
            {m.hasSpike && <Badge tone="orange">Demand spike</Badge>}
          </div>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{p.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <span>
              SKU: <span className="font-mono text-ink-2">{p.sku}</span>
            </span>
            <span>Category: <span className="text-ink-2">{p.category}</span></span>
            <span>Brand: <span className="text-ink-2">{p.brand}</span></span>
            <span>Warehouse: <span className="text-ink-2">{m.warehouse.name}</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
        {kpis.map(([l, v, s]) => (
          <div key={l} className="bg-white px-4 py-3">
            <div className="text-[11.5px] text-muted">{l}</div>
            <div className="tabular mt-1 text-lg font-semibold text-ink">{v}</div>
            {s && <div className="mt-0.5 truncate text-[11px] text-faint">{s}</div>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {recs.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <div className="flex flex-col gap-3 border-l-4 border-l-brand-500 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Recommended action</span>
                    <PriorityBadge priority={r.priority} />
                    <TypeBadge type={r.type} />
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-ink">{r.recommendation}</div>
                  <div className="text-[13px] text-muted">{r.impactLabel}</div>
                </div>
                <Link href={`/recommendations/${r.id}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700">
                  Review <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          ))}

          <Card>
            <CardHeader title="Sales history & forecast" description="Weekly units sold (26 weeks) and forecast (8 weeks)" actions={<TrendIndicator trend={m.demandTrend} pct={m.demandChangePct} />} />
            <div className="px-3 py-4">
              <SalesBarsChart data={productDemandSeries(ds, p.id).slice(-34)} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Inventory history" description="On-hand units, last 26 weeks" />
              <div className="px-3 py-4">
                <StockHistoryChart data={reconstructHistory(ds, p.id, m.onHand)} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Stockout risk" description="Projected stock vs reorder point and safety stock" actions={<RiskBadge risk={m.stockoutRisk} />} />
              <div className="px-3 py-4">
                <ProjectionChart data={buildProjection(ds, m)} height={200} />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Demand trend" />
              <dl className="grid grid-cols-2 gap-4 p-5 text-[13px]">
                {[
                  ["Last 8 weeks", `${fmtNumber(m.weeklyVelocity, 1)} / wk`],
                  ["Last 13 weeks", `${fmtNumber(m.velocity13, 1)} / wk`],
                  ["Prior 13 weeks", `${fmtNumber(m.velocityPrior13, 1)} / wk`],
                  ["Change", fmtPct(m.demandChangePct, 0, true)],
                  ["Variability (σ)", `${fmtNumber(m.weeklyStdDev, 1)} / wk`],
                  ["12-month sales", `${fmtNumber(m.sales12mQty)} units · ${fmtCurrency(m.sales12mRevenue)}`],
                  ["Last sale", m.lastSaleDate ? `${fmtDate(m.lastSaleDate, true)}` : "None"],
                  ["Pattern", m.isSeasonal ? "Seasonal" : m.hasSpike ? "Recent spike" : m.demandTrend],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular mt-0.5 font-medium capitalize text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card>
              <CardHeader title="Forecast" description={`Method: ${fc.method === "seasonal_profile" ? "seasonal profile" : fc.method === "damped_trend" ? "damped-trend exponential smoothing" : "no demand"}`} />
              <Table>
                <thead>
                  <tr>
                    <Th>Week of</Th>
                    <Th align="right">Units</Th>
                    <Th align="right">Revenue</Th>
                  </tr>
                </thead>
                <tbody>
                  {fc.forecast.slice(0, 6).map((f, i) => (
                    <tr key={i}>
                      <Td className="tabular">{fmtDate(addDays(lastWeek, 7 * (i + 1)))}</Td>
                      <Td align="right">{fmtNumber(f, 1)}</Td>
                      <Td align="right">{fmtCurrency(f * p.unitPrice)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          <Card>
            <CardHeader title="Purchase orders" description="Open and recent receipts" />
            <Table>
              <thead>
                <tr>
                  <Th>PO</Th>
                  <Th>Status</Th>
                  <Th>Ordered</Th>
                  <Th>Expected</Th>
                  <Th>Received</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Unit cost</Th>
                  <Th align="right">Lead time</Th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => {
                  const line = po.lines.find((l) => l.productId === p.id)!;
                  const overdue = po.status === "open" && po.expectedDate < ds.asOf;
                  const late = po.receivedDate && po.receivedDate > po.expectedDate;
                  return (
                    <tr key={po.id}>
                      <Td className="font-mono text-[12px] text-ink">{po.poNumber}</Td>
                      <Td>
                        {overdue ? <Badge tone="red">Overdue</Badge> : po.status === "open" ? <Badge tone="brand">Open</Badge> : late ? <Badge tone="amber">Received late</Badge> : <Badge tone="green">Received</Badge>}
                      </Td>
                      <Td className="tabular">{fmtDate(po.orderDate, true)}</Td>
                      <Td className={cn("tabular", overdue && "font-medium text-red-600")}>{fmtDate(po.expectedDate, true)}</Td>
                      <Td className="tabular">{fmtDate(po.receivedDate, true)}</Td>
                      <Td align="right">{fmtNumber(line.qty)}</Td>
                      <Td align="right">{fmtCurrency(line.unitCost, true)}</Td>
                      <Td align="right">{po.receivedDate ? `${daysBetween(po.orderDate, po.receivedDate)}d` : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </div>

        <aside className="space-y-6">
          {supplier && (
            <Card>
              <CardHeader title="Supplier" actions={<Link href={`/suppliers/${supplier.supplier.code.toLowerCase()}`} className="text-xs text-brand-600 hover:underline">Open</Link>} />
              <div className="px-5 py-4">
                <div className="text-sm font-semibold text-ink">{supplier.supplier.name}</div>
                <div className="text-xs text-muted">
                  {supplier.supplier.contactName} · {supplier.supplier.email}
                </div>
              </div>
              <dl className="divide-y divide-line/70 border-t border-line text-[13px]">
                {[
                  ["Reliability", `${fmtPct(supplier.onTimeRate)} on time (${reliabilityLabel(supplier.onTimeRate).label})`],
                  ["Avg actual lead time", `${fmtNumber(supplier.avgLeadTimeDays, 1)} days`],
                  ["Quoted lead time", `${supplier.quotedLeadTimeDays} days`],
                  ["Cost change (12 mo)", fmtPct(priceChange, 1, true)],
                  ["Payment terms", supplier.supplier.paymentTerms],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-5 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          <Card>
            <CardHeader title="Replenishment parameters" description="Calculated by the inventory engine" />
            <dl className="divide-y divide-line/70 text-[13px]">
              {[
                ["Lead-time demand", fmtNumber((m.forecastWeekly / 7) * m.effectiveLeadTimeDays)],
                ["Safety stock", fmtNumber(m.safetyStock)],
                ["Reorder point", fmtNumber(m.reorderPoint)],
                ["Inventory position", fmtNumber(m.inventoryPosition)],
                ["Recommended order", m.needsReorder ? `${fmtNumber(m.recommendedOrderQty)} (${fmtCurrency(m.recommendedOrderValue)})` : "Not required"],
                ["Weeks of cover", m.weeksOfCover === null ? "—" : fmtNumber(m.weeksOfCover, 1)],
                ["Excess units", fmtNumber(m.excessQty)],
                ["Unit price", fmtCurrency(p.unitPrice, true)],
                ["Gross margin", fmtPct(1 - p.unitCost / (p.unitPrice || 1))],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-5 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="tabular text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
