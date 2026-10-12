import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { RecommendationTabs } from "@/components/app/rec-tabs";
import { StockStatusBadge, TrendIndicator } from "@/components/app/badges";
import { fmtCurrency, fmtNumber, fmtWeeks } from "@/lib/utils";

export const metadata: Metadata = { title: "Excess & Slow Stock" };

export default async function ExcessPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const recByProduct = new Map(ws.recommendations.filter((r) => r.productId).map((r) => [r.productId!, r]));
  const list = ws.metrics
    .filter((m) => m.status === "excess" || m.status === "slow" || m.status === "dead")
    .map((m) => ({ m, tied: m.status === "excess" ? m.excessValue : m.inventoryValue }))
    .sort((a, b) => b.tied - a.tied);
  const sumBy = (s: string) => list.filter((x) => x.m.status === s).reduce((a, x) => a + x.tied, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Excess & slow stock" description="Inventory that isn't moving, and stock held well above expected demand." />
      <RecommendationTabs ws={ws} active="/recommendations/excess" />
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Total capital tied up", list.reduce((a, x) => a + x.tied, 0)],
          ["Excess (above 26 wk cover)", sumBy("excess")],
          ["Slow moving (60+ days)", sumBy("slow")],
          ["Dead stock (180+ days)", sumBy("dead")],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border border-line bg-white px-4 py-3">
            <div className="text-xs text-muted">{l}</div>
            <div className="tabular mt-1 text-xl font-semibold text-ink">{fmtCurrency(v as number)}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title={`${list.length} products`} description="Sorted by inventory value tied up" />
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Status</Th>
              <Th align="right">On hand</Th>
              <Th align="right">Inventory value</Th>
              <Th align="right">Value tied up</Th>
              <Th align="right">Days since sale</Th>
              <Th align="right">Velocity (13 wk)</Th>
              <Th align="right">Cover</Th>
              <Th>Recommended action</Th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ m, tied }) => {
              const rec = recByProduct.get(m.product.id);
              return (
                <tr key={m.product.id} className="hover:bg-subtle">
                  <Td className="max-w-[260px]">
                    <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                      {m.product.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted">{m.product.sku}</span> <span className="text-[11px] text-faint">· {m.warehouse.name}</span>
                  </Td>
                  <Td><StockStatusBadge status={m.status} /></Td>
                  <Td align="right">{fmtNumber(m.onHand)}</Td>
                  <Td align="right">{fmtCurrency(m.inventoryValue)}</Td>
                  <Td align="right" className="font-semibold text-ink">{fmtCurrency(tied)}</Td>
                  <Td align="right">{m.daysSinceLastSale ?? "No sales"}</Td>
                  <Td align="right">
                    {fmtNumber(m.velocity13, 1)}/wk
                    <div><TrendIndicator trend={m.demandTrend} pct={m.demandChangePct} /></div>
                  </Td>
                  <Td align="right">{fmtWeeks(m.weeksOfCover)}</Td>
                  <Td className="min-w-[220px] text-[12.5px]">
                    {rec ? (
                      <Link href={`/recommendations/${rec.id}`} className="font-medium text-brand-700 hover:underline">
                        {rec.recommendation}
                      </Link>
                    ) : (
                      "Pause replenishment and monitor"
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
