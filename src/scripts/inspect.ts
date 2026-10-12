// Dev helper: `npx tsx src/scripts/inspect.ts` prints engine output for the demo dataset.
import { generateNorthstarDataset } from "@/lib/mock/generate";
import { analyseDataset } from "@/lib/data/workspace";
import { todayISO } from "@/lib/utils";

const ws = analyseDataset(generateNorthstarDataset(todayISO()));
console.log("KPIs", ws.kpis);
const counts: Record<string, number> = {};
for (const m of ws.metrics) counts[m.status] = (counts[m.status] ?? 0) + 1;
console.log("status", counts);
const rc: Record<string, number> = {};
for (const r of ws.recommendations) rc[`${r.type}:${r.priority}`] = (rc[`${r.type}:${r.priority}`] ?? 0) + 1;
console.log("recs", rc);
for (const m of ws.metrics.filter((x) => x.status !== "healthy")) {
  console.log(
    m.product.sku.padEnd(18),
    m.status.padEnd(8),
    `oh=${m.onHand}`,
    `fw=${m.forecastWeekly}`,
    `lt=${m.effectiveLeadTimeDays}`,
    `rop=${m.reorderPoint}`,
    `pos=${m.inventoryPosition}`,
    `so=${m.daysUntilStockout}`,
    `risk=${m.stockoutRisk}`,
    `qty=${m.recommendedOrderQty}`,
    `ex=${Math.round(m.excessValue)}`,
    `dsl=${m.daysSinceLastSale}`,
    m.demandTrend,
    m.isSeasonal ? "SEAS" : "",
    m.hasSpike ? "SPIKE" : "",
  );
}
for (const s of ws.suppliers) console.log(s.supplier.code, s.onTimeRate.toFixed(2), s.avgLeadTimeDays, s.quotedLeadTimeDays, s.priceChangePct.toFixed(3), s.delayedPos, s.dependency, Math.round(s.revenueShare * 100));
for (const l of ws.lostDemand.slice(0, 15)) console.log(l.item, l.requests, l.estimatedLostSales, l.trend, l.stocked);
