import Link from "next/link";
import type { Metadata } from "next";
import { Activity, CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { demandMovers } from "@/lib/demand";
import { salesHistoryByProduct } from "@/lib/inventory";
import type { ProductMetrics } from "@/lib/types";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DemandTabs } from "@/components/app/demand-tabs";
import { TrendIndicator } from "@/components/app/badges";
import { Sparkline } from "@/components/charts/sparkline";
import { fmtNumber, mean } from "@/lib/utils";

export const metadata: Metadata = { title: "Demand Trends" };

function MoverList({ items, history, color, weeks = 26, empty, detail }: { items: ProductMetrics[]; history: Map<string, number[]>; color: string; weeks?: number; empty: string; detail: (m: ProductMetrics) => string }) {
  if (!items.length) return <EmptyState title={empty} />;
  return (
    <ul className="divide-y divide-line/70">
      {items.map((m) => (
        <li key={m.product.id}>
          <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{m.product.name}</span>
              <span className="text-xs text-muted">
                <span className="font-mono">{m.product.sku}</span> · {detail(m)}
              </span>
            </span>
            <Sparkline values={(history.get(m.product.id) ?? []).slice(-weeks)} width={110} className={color} />
            <span className="w-14 text-right">
              <TrendIndicator trend={m.demandTrend} pct={m.demandChangePct} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DemandTrendsPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const movers = demandMovers(ws.metrics);
  const history = salesHistoryByProduct(ws.dataset);
  const vel = (m: ProductMetrics) => `${fmtNumber(m.velocityPrior13, 1)} → ${fmtNumber(m.velocity13, 1)} /wk`;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Demand" description="Which products are accelerating, slowing, seasonal or spiking — last 13 weeks vs prior 13 weeks." />
      <DemandTabs active="/demand/trends" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Increasing demand", movers.increasing.length, "text-emerald-700"],
          ["Declining demand", movers.declining.length, "text-red-600"],
          ["Seasonal products", movers.seasonal.length, "text-sky-700"],
          ["Demand spikes (last week)", movers.spikes.length, "text-orange-600"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg border border-line bg-white px-4 py-3">
            <div className="text-xs text-muted">{l}</div>
            <div className={`tabular mt-1 text-2xl font-semibold ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<TrendingUp className="h-4 w-4" />} title="Increasing demand" description="Up more than 20%" />
          <MoverList items={movers.increasing} history={history} color="text-emerald-500" empty="No products with rising demand" detail={vel} />
        </Card>
        <Card>
          <CardHeader icon={<TrendingDown className="h-4 w-4" />} title="Declining demand" description="Down more than 20%" />
          <MoverList items={movers.declining} history={history} color="text-red-500" empty="No products with declining demand" detail={vel} />
        </Card>
        <Card>
          <CardHeader icon={<CalendarRange className="h-4 w-4" />} title="Seasonal products" description="Repeating annual pattern — 52-week view" />
          <MoverList
            items={movers.seasonal}
            history={history}
            color="text-sky-500"
            weeks={52}
            empty="No seasonal patterns detected"
            detail={(m) => {
              const h = history.get(m.product.id) ?? [];
              const peak = h.indexOf(Math.max(...h));
              return `peak ${fmtNumber(Math.max(...h))}/wk ${52 - peak} weeks ago · avg ${fmtNumber(mean(h), 1)}/wk`;
            }}
          />
        </Card>
        <Card>
          <CardHeader icon={<Activity className="h-4 w-4" />} title="Demand spikes" description="Last week far above the 12-week norm" />
          <MoverList
            items={movers.spikes}
            history={history}
            color="text-orange-500"
            weeks={13}
            empty="No demand spikes last week"
            detail={(m) => {
              const h = history.get(m.product.id) ?? [];
              return `last week ${fmtNumber(h[h.length - 1])} vs ${fmtNumber(mean(h.slice(-13, -1)), 1)} avg`;
            }}
          />
        </Card>
      </div>
    </div>
  );
}
