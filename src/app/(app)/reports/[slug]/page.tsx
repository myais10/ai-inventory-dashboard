import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace, type Workspace } from "@/lib/data";
import { REPORTS } from "@/lib/reports";
import { demandMovers } from "@/lib/demand";
import { STATUS_META } from "@/lib/inventory";
import { TYPE_META } from "@/lib/recommendations";
import { Table, Td, Th } from "@/components/ui";
import { PrintButton } from "@/components/app/print-button";
import { cn, fmtCompactCurrency, fmtCurrency, fmtDate, fmtNumber, fmtPct, fmtWeeks } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = REPORTS.find((x) => x.slug === slug);
  return { title: r?.title ?? "Report" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-line px-8 py-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Kpis({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([l, v]) => (
        <div key={l}>
          <div className="text-[11.5px] text-muted">{l}</div>
          <div className="tabular mt-0.5 text-xl font-semibold text-ink">{v}</div>
        </div>
      ))}
    </div>
  );
}

function ReorderTable({ ws }: { ws: Workspace }) {
  const groups = new Map<string, Workspace["metrics"]>();
  for (const m of ws.metrics.filter((x) => x.needsReorder)) groups.set(m.supplier.name, [...(groups.get(m.supplier.name) ?? []), m]);
  return (
    <div className="space-y-5">
      {[...groups.entries()]
        .sort((a, b) => b[1].reduce((s, m) => s + m.recommendedOrderValue, 0) - a[1].reduce((s, m) => s + m.recommendedOrderValue, 0))
        .map(([sup, ms]) => (
          <div key={sup} className="overflow-hidden rounded-lg border border-line">
            <div className="flex justify-between bg-subtle px-4 py-2 text-[13px] font-semibold">
              <span>{sup}</span>
              <span className="tabular">{fmtCurrency(ms.reduce((s, m) => s + m.recommendedOrderValue, 0))}</span>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Product</Th>
                  <Th align="right">On hand</Th>
                  <Th align="right">On order</Th>
                  <Th align="right">Reorder pt</Th>
                  <Th align="right">Order qty</Th>
                  <Th align="right">Value</Th>
                </tr>
              </thead>
              <tbody>
                {ms.map((m) => (
                  <tr key={m.product.id}>
                    <Td className="font-mono text-[11.5px]">{m.product.sku}</Td>
                    <Td>{m.product.name}</Td>
                    <Td align="right">{fmtNumber(m.onHand)}</Td>
                    <Td align="right">{fmtNumber(m.openPoQty)}</Td>
                    <Td align="right">{fmtNumber(m.reorderPoint)}</Td>
                    <Td align="right" className="font-semibold text-ink">{fmtNumber(m.recommendedOrderQty)}</Td>
                    <Td align="right">{fmtCurrency(m.recommendedOrderValue)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
    </div>
  );
}

function StockoutTable({ ws }: { ws: Workspace }) {
  const list = ws.metrics.filter((m) => m.stockoutRisk === "high" || m.stockoutRisk === "medium").sort((a, b) => (a.daysUntilStockout ?? 99) - (b.daysUntilStockout ?? 99));
  const rec = new Map(ws.recommendations.filter((r) => r.productId).map((r) => [r.productId!, r]));
  return (
    <Table>
      <thead>
        <tr>
          <Th>Product</Th>
          <Th>Risk</Th>
          <Th>Stockout</Th>
          <Th align="right">Stock</Th>
          <Th align="right">Demand/wk</Th>
          <Th align="right">Lead time</Th>
          <Th>Action</Th>
        </tr>
      </thead>
      <tbody>
        {list.map((m) => (
          <tr key={m.product.id}>
            <Td>
              {m.product.name}
              <div className="font-mono text-[11px] text-muted">{m.product.sku}</div>
            </Td>
            <Td className={cn("font-medium capitalize", m.stockoutRisk === "high" ? "text-red-600" : "text-orange-600")}>{m.stockoutRisk}</Td>
            <Td className="tabular">{fmtDate(m.projectedStockoutDate)}</Td>
            <Td align="right">{fmtNumber(m.available)}</Td>
            <Td align="right">{fmtNumber(m.forecastWeekly, 1)}</Td>
            <Td align="right">{m.effectiveLeadTimeDays}d</Td>
            <Td className="text-[12.5px]">{rec.get(m.product.id)?.recommendation ?? "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function ExcessTable({ ws }: { ws: Workspace }) {
  const list = ws.metrics
    .filter((m) => ["excess", "slow", "dead"].includes(m.status))
    .map((m) => ({ m, tied: m.status === "excess" ? m.excessValue : m.inventoryValue }))
    .sort((a, b) => b.tied - a.tied);
  return (
    <Table>
      <thead>
        <tr>
          <Th>Product</Th>
          <Th>Status</Th>
          <Th align="right">On hand</Th>
          <Th align="right">Days since sale</Th>
          <Th align="right">Cover</Th>
          <Th align="right">Tied up</Th>
        </tr>
      </thead>
      <tbody>
        {list.map(({ m, tied }) => (
          <tr key={m.product.id}>
            <Td>
              {m.product.name}
              <div className="font-mono text-[11px] text-muted">{m.product.sku}</div>
            </Td>
            <Td>{STATUS_META[m.status].label}</Td>
            <Td align="right">{fmtNumber(m.onHand)}</Td>
            <Td align="right">{m.daysSinceLastSale ?? "—"}</Td>
            <Td align="right">{fmtWeeks(m.weeksOfCover)}</Td>
            <Td align="right" className="font-semibold text-ink">{fmtCurrency(tied)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function LostTable({ ws }: { ws: Workspace }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Item</Th>
          <Th align="right">Requests</Th>
          <Th align="right">Customers</Th>
          <Th>Trend</Th>
          <Th align="right">Lost sales</Th>
          <Th>Recommendation</Th>
        </tr>
      </thead>
      <tbody>
        {ws.lostDemand
          .filter((l) => !l.stocked)
          .map((l) => (
            <tr key={l.itemKey}>
              <Td>{l.item}</Td>
              <Td align="right">{l.requests}</Td>
              <Td align="right">{l.customers}</Td>
              <Td className="capitalize">{l.trend}</Td>
              <Td align="right" className="font-semibold text-ink">{fmtCurrency(l.estimatedLostSales)}</Td>
              <Td className="text-[12.5px]">{l.recommendation}</Td>
            </tr>
          ))}
      </tbody>
    </Table>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = REPORTS.find((r) => r.slug === slug);
  if (!report) notFound();
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const { kpis, health } = ws;
  const movers = demandMovers(ws.metrics);
  const high = ws.recommendations.filter((r) => r.priority === "high" && (r.status === "new" || r.status === "in_review"));

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
          <ChevronLeft className="h-3.5 w-3.5" /> Reports
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-line bg-white shadow-sm print:border-0 print:shadow-none">
        <header className="flex flex-col gap-2 bg-[#0b1430] px-8 py-7 text-white sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-brand-200">{ws.dataset.company.name}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{report.title}</h1>
            <p className="mt-1 text-sm text-white/70">{report.description}</p>
          </div>
          <div className="text-right text-xs text-white/60">
            <div>As of {fmtDate(ws.dataset.asOf, true)}</div>
            <div>Prepared for {session.user.fullName}</div>
          </div>
        </header>

        <Section title="Summary">
          <Kpis
            items={[
              ["Total inventory", fmtCompactCurrency(kpis.totalInventory)],
              ["Reorder required", String(kpis.reorderRequired)],
              ["Stockout risks", String(kpis.stockoutRisks)],
              ["Excess inventory", fmtCompactCurrency(kpis.excessInventory)],
              ["Lost demand", fmtCompactCurrency(kpis.lostDemand)],
              ["Purchasing", fmtCompactCurrency(kpis.recommendedPurchasing)],
            ]}
          />
        </Section>

        {slug === "weekly-inventory" && (
          <>
            <Section title="Key messages">
              <ul className="space-y-2 text-[14px] text-ink-2">
                <li>• <b className="text-ink">{kpis.stockoutRisks} SKUs</b> will run out before a new order can arrive; {kpis.stockoutWatch} more are on watch.</li>
                <li>• <b className="text-ink">{kpis.reorderRequired} SKUs</b> need reordering — {fmtCurrency(kpis.recommendedPurchasing)} at cost.</li>
                <li>• <b className="text-ink">{fmtCurrency(kpis.excessInventory)}</b> ({fmtPct(kpis.excessInventory / (kpis.totalInventory || 1))} of inventory) is excess, slow or dead stock.</li>
                <li>• Demand is rising on <b className="text-ink">{movers.increasing.length} SKUs</b> and declining on {movers.declining.length}.</li>
                <li>• Customers requested unstocked items worth <b className="text-ink">{fmtCurrency(kpis.lostDemand)}</b> over the past year.</li>
                <li>• Inventory turns {health.turnover.toFixed(1)}× per year; {fmtPct(health.healthyPct)} of SKUs are healthy.</li>
              </ul>
            </Section>
            <Section title="Top priority actions">
              <Table>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Item</Th>
                    <Th>Action</Th>
                    <Th align="right">Impact</Th>
                  </tr>
                </thead>
                <tbody>
                  {high.slice(0, 12).map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap">{TYPE_META[r.type].label}</Td>
                      <Td>{r.title}</Td>
                      <Td className="text-[12.5px]">{r.recommendation}</Td>
                      <Td align="right" className="whitespace-nowrap">{fmtCurrency(r.impactValue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Section>
            <Section title="Supplier watchlist">
              <Table>
                <thead>
                  <tr>
                    <Th>Supplier</Th>
                    <Th align="right">On time</Th>
                    <Th align="right">Lead time</Th>
                    <Th align="right">Overdue POs</Th>
                    <Th align="right">Cost change</Th>
                  </tr>
                </thead>
                <tbody>
                  {ws.suppliers
                    .filter((s) => s.onTimeRate < 0.85 || s.delayedPos || s.priceChangePct > 0.05)
                    .map((s) => (
                      <tr key={s.supplier.id}>
                        <Td>{s.supplier.name}</Td>
                        <Td align="right">{fmtPct(s.onTimeRate)}</Td>
                        <Td align="right">{fmtNumber(s.avgLeadTimeDays, 1)}d / {s.quotedLeadTimeDays}d</Td>
                        <Td align="right">{s.delayedPos}</Td>
                        <Td align="right">{fmtPct(s.priceChangePct, 1, true)}</Td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </Section>
          </>
        )}
        {slug === "reorder" && (
          <Section title="Recommended orders by supplier">
            <ReorderTable ws={ws} />
          </Section>
        )}
        {slug === "stockout-risk" && (
          <Section title="Products at risk">
            <StockoutTable ws={ws} />
          </Section>
        )}
        {slug === "excess-inventory" && (
          <Section title="Excess, slow & dead stock">
            <ExcessTable ws={ws} />
          </Section>
        )}
        {slug === "lost-demand" && (
          <Section title="Requested items not stocked">
            <LostTable ws={ws} />
          </Section>
        )}
        <footer className="border-t border-line px-8 py-4 text-[11px] text-faint">
          All figures calculated deterministically from imported inventory, sales, purchasing and enquiry data. AI Inventory & Demand Intelligence.
        </footer>
      </article>
    </div>
  );
}
