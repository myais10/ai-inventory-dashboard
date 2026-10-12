// Supplier performance — deterministic calculations from purchase-order history.

import type { Dataset, ProductMetrics, SupplierMetrics } from "@/lib/types";
import { addDays, daysBetween, fmtMonth, mean, round, sum } from "@/lib/utils";

export interface LeadTimeStats {
  avgLeadTimeDays: number;
  recentLeadTimeDays: number;
  onTimeRate: number;
  avgDelayDays: number;
  receivedPos: number;
}

/** Actual lead time and on-time performance per supplier from received POs. */
export function computeLeadTimeStats(ds: Dataset): Map<string, LeadTimeStats> {
  const out = new Map<string, LeadTimeStats>();
  for (const s of ds.suppliers) {
    const received = ds.purchaseOrders
      .filter((po) => po.supplierId === s.id && po.status === "received" && po.receivedDate)
      .sort((a, b) => (a.receivedDate! < b.receivedDate! ? -1 : 1));
    if (!received.length) {
      out.set(s.id, { avgLeadTimeDays: s.quotedLeadTimeDays, recentLeadTimeDays: s.quotedLeadTimeDays, onTimeRate: 1, avgDelayDays: 0, receivedPos: 0 });
      continue;
    }
    const lts = received.map((po) => daysBetween(po.orderDate, po.receivedDate!));
    const delays = received.map((po) => Math.max(0, daysBetween(po.expectedDate, po.receivedDate!)));
    const recentCutoff = addDays(ds.asOf, -120);
    const recent = received.filter((po) => po.receivedDate! >= recentCutoff).map((po) => daysBetween(po.orderDate, po.receivedDate!));
    out.set(s.id, {
      avgLeadTimeDays: round(mean(lts), 1),
      recentLeadTimeDays: round(recent.length ? mean(recent) : mean(lts), 1),
      onTimeRate: received.filter((_, i) => delays[i] <= 1).length / received.length,
      avgDelayDays: round(mean(delays.filter((d) => d > 1)) || 0, 1),
      receivedPos: received.length,
    });
  }
  return out;
}

export function computeSupplierMetrics(ds: Dataset, leadStats: Map<string, LeadTimeStats>, metrics: ProductMetrics[]): SupplierMetrics[] {
  const totalRevenue = sum(metrics.map((m) => m.sales12mRevenue)) || 1;
  const yearAgo = addDays(ds.asOf, -365);
  const halfYearAgo = addDays(ds.asOf, -180);

  return ds.suppliers
    .map((s) => {
      const stats = leadStats.get(s.id)!;
      const prods = metrics.filter((m) => m.product.supplierId === s.id);
      const pos = ds.purchaseOrders.filter((po) => po.supplierId === s.id);
      const open = pos.filter((po) => po.status === "open" || po.status === "partial");
      const delayed = open.filter((po) => po.expectedDate < ds.asOf);
      const spend12m = sum(
        pos.filter((po) => po.orderDate >= yearAgo && po.status !== "cancelled").flatMap((po) => po.lines.map((l) => l.qty * l.unitCost)),
      );
      const openPoValue = sum(open.flatMap((po) => po.lines.map((l) => (l.qty - l.qtyReceived) * l.unitCost)));

      // Weighted cost change across the supplier's SKUs over the last 6 months.
      const changes: { w: number; pct: number }[] = [];
      for (const m of prods) {
        const pts = ds.priceHistory.filter((p) => p.productId === m.product.id).sort((a, b) => (a.date < b.date ? -1 : 1));
        const before = [...pts].reverse().find((p) => p.date <= halfYearAgo);
        const now = pts[pts.length - 1];
        if (before && now && before.unitCost > 0) changes.push({ w: m.sales12mQty * now.unitCost || 1, pct: now.unitCost / before.unitCost - 1 });
      }
      const wSum = sum(changes.map((c) => c.w)) || 1;
      const priceChangePct = sum(changes.map((c) => c.w * c.pct)) / wSum;

      const revenueShare = sum(prods.map((m) => m.sales12mRevenue)) / totalRevenue;
      const atRiskSkus = prods.filter((m) => m.stockoutRisk === "high" || m.stockoutRisk === "medium").length;
      const dependency: SupplierMetrics["dependency"] =
        revenueShare >= 0.12 || (revenueShare >= 0.07 && stats.onTimeRate < 0.8) ? "high" : revenueShare >= 0.05 ? "medium" : "low";

      // Monthly actual lead time trend (last 6 months).
      const leadTimeHistory: { month: string; days: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const start = addDays(ds.asOf, -30 * (i + 1));
        const end = addDays(ds.asOf, -30 * i);
        const inMonth = pos.filter((po) => po.receivedDate && po.receivedDate >= start && po.receivedDate < end);
        const prev = leadTimeHistory[leadTimeHistory.length - 1]?.days ?? stats.avgLeadTimeDays;
        leadTimeHistory.push({
          month: fmtMonth(end),
          days: inMonth.length ? round(mean(inMonth.map((po) => daysBetween(po.orderDate, po.receivedDate!))), 1) : prev,
        });
      }

      return {
        supplier: s,
        skuCount: prods.length,
        quotedLeadTimeDays: s.quotedLeadTimeDays,
        avgLeadTimeDays: stats.avgLeadTimeDays,
        onTimeRate: stats.onTimeRate,
        avgDelayDays: stats.avgDelayDays,
        receivedPos: stats.receivedPos,
        openPos: open.length,
        delayedPos: delayed.length,
        openPoValue,
        spend12m,
        priceChangePct,
        revenueShare,
        atRiskSkus,
        dependency,
        leadTimeHistory,
      } satisfies SupplierMetrics;
    })
    .sort((a, b) => b.spend12m - a.spend12m);
}

export function reliabilityLabel(onTime: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (onTime >= 0.9) return { label: "Reliable", tone: "good" };
  if (onTime >= 0.78) return { label: "Variable", tone: "warn" };
  return { label: "Unreliable", tone: "bad" };
}
