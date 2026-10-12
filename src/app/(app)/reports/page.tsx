import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, CalendarClock, FileBarChart, PackageX, SearchX, ShoppingCart } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { REPORTS } from "@/lib/reports";
import { PageHeader } from "@/components/ui";
import { fmtCompactCurrency, fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const ICONS = { "weekly-inventory": FileBarChart, reorder: ShoppingCart, "stockout-risk": AlertTriangle, "excess-inventory": PackageX, "lost-demand": SearchX };

export default async function ReportsPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const headline: Record<string, string> = {
    "weekly-inventory": `${fmtCompactCurrency(ws.kpis.totalInventory)} inventory · ${ws.recommendations.filter((r) => r.priority === "high").length} high-priority actions`,
    reorder: `${ws.kpis.reorderRequired} SKUs · ${fmtCompactCurrency(ws.kpis.recommendedPurchasing)}`,
    "stockout-risk": `${ws.kpis.stockoutRisks} high risk · ${ws.kpis.stockoutWatch} on watch`,
    "excess-inventory": `${fmtCompactCurrency(ws.kpis.excessInventory)} tied up`,
    "lost-demand": `${fmtCompactCurrency(ws.kpis.lostDemand)} estimated lost sales`,
  };
  return (
    <div className="animate-fade-in">
      <PageHeader title="Reports" description={`Generated from data as of ${fmtDate(ws.dataset.asOf, true)}. Share with your team or save as PDF.`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = ICONS[r.slug];
          return (
            <Link key={r.slug} href={`/reports/${r.slug}`} className="group flex flex-col rounded-xl border border-line bg-white p-5 transition hover:border-line-strong hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <CalendarClock className="h-3 w-3" /> {r.cadence}
                </span>
              </div>
              <h2 className="mt-4 text-[15px] font-semibold text-ink">{r.title}</h2>
              <p className="mt-1 flex-1 text-[13px] text-muted">{r.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[13px]">
                <span className="font-medium text-ink-2">{headline[r.slug]}</span>
                <ArrowRight className="h-4 w-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
