import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Card, PageHeader, ProgressBar } from "@/components/ui";
import { DependencyBadge, ReliabilityBadge, SupplierTabs } from "@/components/app/supplier-tabs";
import { cn, fmtCurrency, fmtNumber, fmtPct } from "@/lib/utils";

export const metadata: Metadata = { title: "Supplier Performance" };

export default async function SupplierPerformancePage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const ranked = [...ws.suppliers].sort((a, b) => a.onTimeRate - b.onTimeRate);
  const avgOnTime = ws.suppliers.reduce((a, s) => a + s.onTimeRate * s.spend12m, 0) / (ws.suppliers.reduce((a, s) => a + s.spend12m, 0) || 1);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Supplier performance" description="Scorecards ranked from least to most reliable. Delivery performance is measured against each PO's expected date." />
      <SupplierTabs active="/suppliers/performance" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Spend-weighted on-time rate", fmtPct(avgOnTime)],
          ["Suppliers below 80% on time", String(ws.suppliers.filter((s) => s.onTimeRate < 0.8).length)],
          ["Overdue purchase orders", String(ws.suppliers.reduce((a, s) => a + s.delayedPos, 0))],
          ["Suppliers with >5% cost increase", String(ws.suppliers.filter((s) => s.priceChangePct > 0.05).length)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line bg-white px-4 py-3">
            <div className="text-xs text-muted">{l}</div>
            <div className="tabular mt-1 text-2xl font-semibold text-ink">{v}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {ranked.map((s) => {
          const ltRatio = s.avgLeadTimeDays / (s.quotedLeadTimeDays || 1);
          return (
            <Card key={s.supplier.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/suppliers/${s.supplier.code.toLowerCase()}`} className="block truncate text-[15px] font-semibold text-ink hover:text-brand-600">
                    {s.supplier.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {s.skuCount} SKUs · {fmtCurrency(s.spend12m)} spend
                  </div>
                </div>
                <ReliabilityBadge onTime={s.onTimeRate} />
              </div>
              <div className="mt-4 space-y-3 text-[13px]">
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-muted">On-time delivery</span>
                    <span className="tabular font-medium text-ink">{fmtPct(s.onTimeRate)}</span>
                  </div>
                  <ProgressBar value={s.onTimeRate} tone={s.onTimeRate >= 0.9 ? "green" : s.onTimeRate >= 0.78 ? "amber" : "red"} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-muted">Lead time: actual vs quoted</span>
                    <span className={cn("tabular font-medium", ltRatio > 1.1 ? "text-red-600" : "text-ink")}>
                      {fmtNumber(s.avgLeadTimeDays, 1)}d / {s.quotedLeadTimeDays}d
                    </span>
                  </div>
                  <ProgressBar value={Math.min(1, s.quotedLeadTimeDays / (s.avgLeadTimeDays || 1))} tone={ltRatio > 1.1 ? "red" : "green"} />
                </div>
                <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3">
                  <div>
                    <dt className="text-[11px] text-muted">Late by (avg)</dt>
                    <dd className="tabular font-medium text-ink">{s.avgDelayDays ? `${fmtNumber(s.avgDelayDays, 1)}d` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Overdue POs</dt>
                    <dd className={cn("tabular font-medium", s.delayedPos ? "text-red-600" : "text-ink")}>{s.delayedPos}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Cost change</dt>
                    <dd className={cn("tabular font-medium", s.priceChangePct > 0.05 ? "text-red-600" : "text-ink")}>{fmtPct(s.priceChangePct, 1, true)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">SKUs at risk</dt>
                    <dd className={cn("tabular font-medium", s.atRiskSkus ? "text-red-600" : "text-ink")}>{s.atRiskSkus}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Revenue share</dt>
                    <dd className="tabular font-medium text-ink">{fmtPct(s.revenueShare, 1)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">Dependency</dt>
                    <dd><DependencyBadge level={s.dependency} /></dd>
                  </div>
                </dl>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
