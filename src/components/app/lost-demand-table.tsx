import Link from "next/link";
import type { LostDemandItem, Recommendation } from "@/lib/types";
import { Card, CardHeader, Table, Td, Th } from "@/components/ui";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendIndicator } from "./badges";
import { fmtCurrency, fmtDate } from "@/lib/utils";

export function LostDemandSummary({ items }: { items: LostDemandItem[] }) {
  const unstocked = items.filter((l) => !l.stocked);
  const stocked = items.filter((l) => l.stocked);
  const cards: [string, string][] = [
    ["Estimated lost sales (12 mo)", fmtCurrency(items.reduce((a, l) => a + l.estimatedLostSales, 0))],
    ["Unstocked items requested", String(unstocked.length)],
    ["Customer requests", String(unstocked.reduce((a, l) => a + l.requests, 0))],
    ["Lost to stockouts (stocked SKUs)", fmtCurrency(stocked.reduce((a, l) => a + l.estimatedLostSales, 0))],
  ];
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([l, v]) => (
        <div key={l} className="rounded-lg border border-line bg-white px-4 py-3">
          <div className="text-xs text-muted">{l}</div>
          <div className="tabular mt-1 text-xl font-semibold text-ink">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function LostDemandTable({ items, recs }: { items: LostDemandItem[]; recs: Recommendation[] }) {
  const recByKey = new Map(recs.filter((r) => r.itemKey).map((r) => [r.itemKey!, r]));
  const unstocked = items.filter((l) => !l.stocked);
  const stocked = items.filter((l) => l.stocked);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Requested but not stocked" description="Customer enquiries and quotes for items outside your current range" />
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th align="right">Requests</Th>
              <Th align="right">Quotes</Th>
              <Th align="right">Customers</Th>
              <Th align="right">Est. lost sales</Th>
              <Th>First requested</Th>
              <Th>Last requested</Th>
              <Th>12-month trend</Th>
              <Th>Recommendation</Th>
            </tr>
          </thead>
          <tbody>
            {unstocked.map((l) => {
              const rec = recByKey.get(l.itemKey);
              return (
                <tr key={l.itemKey} className="hover:bg-subtle">
                  <Td className="max-w-[280px]">
                    <div className="truncate font-medium text-ink">{l.item}</div>
                    <div className="text-[11px] text-muted">{l.category} · avg {fmtCurrency(l.avgPrice)}</div>
                  </Td>
                  <Td align="right" className="font-medium text-ink">{l.requests}</Td>
                  <Td align="right">{l.quotes}</Td>
                  <Td align="right">{l.customers}</Td>
                  <Td align="right" className="font-semibold text-ink">{fmtCurrency(l.estimatedLostSales)}</Td>
                  <Td className="tabular whitespace-nowrap text-xs">{fmtDate(l.firstRequested, true)}</Td>
                  <Td className="tabular whitespace-nowrap text-xs">{fmtDate(l.lastRequested, true)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Sparkline values={l.monthly} width={64} height={22} className={l.trend === "increasing" ? "text-emerald-500" : l.trend === "declining" ? "text-red-400" : "text-slate-400"} />
                      <TrendIndicator trend={l.trend} />
                    </div>
                  </Td>
                  <Td className="min-w-[220px] text-[12.5px]">
                    {rec ? (
                      <Link href={`/recommendations/${rec.id}`} className="font-medium text-brand-700 hover:underline">
                        {l.recommendation}
                      </Link>
                    ) : (
                      <span className="text-muted">{l.recommendation}</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {stocked.length > 0 && (
        <Card>
          <CardHeader title="Lost to stockouts" description="Stocked items where customers walked away because we had no stock" />
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th align="right">Lost enquiries</Th>
                <Th align="right">Customers</Th>
                <Th align="right">Est. lost sales</Th>
                <Th>Last lost</Th>
                <Th>Recommendation</Th>
              </tr>
            </thead>
            <tbody>
              {stocked.map((l) => (
                <tr key={l.itemKey} className="hover:bg-subtle">
                  <Td className="max-w-[300px]">
                    <Link href={`/products/${encodeURIComponent(l.itemKey.toUpperCase())}`} className="block truncate font-medium text-ink hover:text-brand-600">
                      {l.item}
                    </Link>
                  </Td>
                  <Td align="right">{l.requests}</Td>
                  <Td align="right">{l.customers}</Td>
                  <Td align="right" className="font-semibold text-ink">{fmtCurrency(l.estimatedLostSales)}</Td>
                  <Td className="tabular text-xs">{fmtDate(l.lastRequested, true)}</Td>
                  <Td className="text-[12.5px] text-muted">{l.recommendation}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
