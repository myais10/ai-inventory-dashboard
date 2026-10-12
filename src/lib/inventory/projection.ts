import type { Dataset, ProductMetrics } from "@/lib/types";
import { addDays, daysBetween, fmtDate } from "@/lib/utils";

/** Day-by-day projected stock (sampled every 2 days) consuming forecast demand and receiving open POs. */
export function buildProjection(ds: Dataset, m: ProductMetrics, horizonDays = 56) {
  const daily = m.forecastWeekly / 7;
  const receipts = ds.purchaseOrders
    .filter((po) => po.status === "open" || po.status === "partial")
    .flatMap((po) =>
      po.lines
        .filter((l) => l.productId === m.product.id)
        .map((l) => ({ day: po.expectedDate < ds.asOf ? 4 : daysBetween(ds.asOf, po.expectedDate), qty: l.qty - l.qtyReceived })),
    );
  const points: { label: string; stock: number; safety: number; reorderPoint: number }[] = [];
  let stock = m.available;
  for (let d = 0; d <= horizonDays; d++) {
    for (const r of receipts) if (r.day === d) stock += r.qty;
    if (d % 2 === 0) points.push({ label: fmtDate(addDays(ds.asOf, d)), stock: Math.max(0, Math.round(stock)), safety: m.safetyStock, reorderPoint: m.reorderPoint });
    stock -= daily;
  }
  return points;
}

/**
 * Reconstruct weekly on-hand history backwards from today's stock:
 * stock(start of week) = stock(end of week) + units sold − units received.
 * Used until real inventory_snapshots exist for the tenant.
 */
export function reconstructHistory(ds: Dataset, productId: string, onHand: number, weeks = 26) {
  const sales = ds.salesWeeks.filter((s) => s.productId === productId).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  const receipts = ds.purchaseOrders
    .filter((po) => po.receivedDate)
    .flatMap((po) => po.lines.filter((l) => l.productId === productId).map((l) => ({ date: po.receivedDate!, qty: l.qtyReceived })));
  const out: { label: string; stock: number }[] = [];
  let stock = onHand;
  for (const w of sales.slice(0, weeks)) {
    out.push({ label: fmtDate(addDays(w.weekStart, 7)), stock: Math.max(0, Math.round(stock)) });
    const received = receipts.filter((r) => r.date >= w.weekStart && r.date < addDays(w.weekStart, 7)).reduce((a, r) => a + r.qty, 0);
    stock = stock + w.qty - received;
  }
  return out.reverse();
}
