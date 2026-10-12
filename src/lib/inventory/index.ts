// Deterministic inventory engine: velocity, days of stock, safety stock, reorder point,
// projected stockout, reorder quantity and excess. Every number shown to users comes from here.

import type { Dataset, DemandTrend, ProductMetrics, RiskLevel, StockStatus } from "@/lib/types";
import { detectSeasonality, detectSpike, forecastDemand } from "@/lib/forecasting";
import type { LeadTimeStats } from "@/lib/suppliers";
import { addDays, daysBetween, mean, round, stdDev, sum } from "@/lib/utils";

export const POLICY = {
  serviceLevelZ: 1.65, // ~95% cycle service level
  reviewCoverDays: 28, // order-up-to covers lead time + 4 weeks
  excessCoverWeeks: 26, // stock above 26 weeks of forecast demand is excess
  slowDaysSinceSale: 60,
  deadDaysSinceSale: 180,
  stockoutHorizonBufferDays: 7,
} as const;

export function salesHistoryByProduct(ds: Dataset): Map<string, number[]> {
  const map = new Map<string, { w: string; q: number }[]>();
  for (const s of ds.salesWeeks) {
    if (!map.has(s.productId)) map.set(s.productId, []);
    map.get(s.productId)!.push({ w: s.weekStart, q: s.qty });
  }
  const out = new Map<string, number[]>();
  for (const [k, v] of map) out.set(k, v.sort((a, b) => (a.w < b.w ? -1 : 1)).map((x) => x.q));
  return out;
}

/**
 * Walk forward day by day consuming forecast demand and receiving open POs on their expected date.
 * Returns the first day stock hits zero (if within horizon).
 */
export function projectStockout(onHand: number, dailyDemand: number, receipts: { inDays: number; qty: number }[], horizonDays: number) {
  if (dailyDemand <= 0) return undefined;
  let stock = onHand;
  for (let d = 0; d <= horizonDays; d++) {
    for (const r of receipts) if (Math.max(0, r.inDays) === d) stock += r.qty;
    if (stock - dailyDemand < 0) {
      // fractional day when stock runs out
      return d + Math.max(0, stock) / dailyDemand;
    }
    stock -= dailyDemand;
  }
  return undefined;
}

export function computeProductMetrics(ds: Dataset, leadStats: Map<string, LeadTimeStats>): ProductMetrics[] {
  const history = salesHistoryByProduct(ds);
  const supplierById = new Map(ds.suppliers.map((s) => [s.id, s]));
  const whById = new Map(ds.warehouses.map((w) => [w.id, w]));
  const invByProduct = new Map<string, { onHand: number; allocated: number }>();
  for (const r of ds.inventory) {
    const cur = invByProduct.get(r.productId) ?? { onHand: 0, allocated: 0 };
    invByProduct.set(r.productId, { onHand: cur.onHand + r.onHand, allocated: cur.allocated + r.allocated });
  }
  const revenueByProduct = new Map<string, number>();
  for (const s of ds.salesWeeks) revenueByProduct.set(s.productId, (revenueByProduct.get(s.productId) ?? 0) + s.revenue);

  return ds.products.map((product) => {
    const h = history.get(product.id) ?? [];
    const inv = invByProduct.get(product.id) ?? { onHand: 0, allocated: 0 };
    const supplier = supplierById.get(product.supplierId)!;
    const warehouse = whById.get(product.warehouseId)!;
    const lt = leadStats.get(product.supplierId);

    const weeklyVelocity = mean(h.slice(-8));
    const velocity13 = mean(h.slice(-13));
    const velocityPrior13 = mean(h.slice(-26, -13));
    const demandChangePct = velocityPrior13 > 0 ? velocity13 / velocityPrior13 - 1 : velocity13 > 0 ? 1 : 0;
    const demandTrend: DemandTrend =
      velocity13 < 0.5 && velocityPrior13 < 0.5 ? "stable" : demandChangePct > 0.2 ? "increasing" : demandChangePct < -0.2 ? "declining" : "stable";

    const fc = forecastDemand(h, 12);
    const forecastWeekly = fc.shortTermWeekly;
    const dailyDemand = forecastWeekly / 7;
    const weeklyStdDev = stdDev(h.slice(-26));

    // Effective lead time: never assume better than quoted; use observed recent performance when worse.
    const effectiveLeadTimeDays = Math.round(Math.max(product.leadTimeDays, lt?.recentLeadTimeDays ?? 0));
    const safetyStock =
      product.safetyStockOverride ?? Math.ceil(POLICY.serviceLevelZ * weeklyStdDev * Math.sqrt(effectiveLeadTimeDays / 7));
    const reorderPoint = Math.ceil(dailyDemand * effectiveLeadTimeDays + safetyStock);

    const openLines = ds.purchaseOrders
      .filter((po) => po.status === "open" || po.status === "partial")
      .flatMap((po) => po.lines.filter((l) => l.productId === product.id).map((l) => ({ po, qty: l.qty - l.qtyReceived })))
      .filter((x) => x.qty > 0)
      .sort((a, b) => (a.po.expectedDate < b.po.expectedDate ? -1 : 1));
    const openPoQty = sum(openLines.map((x) => x.qty));
    // Overdue POs are assumed to land after the supplier's typical delay from today.
    const receipts = openLines.map((x) => ({
      inDays: x.po.expectedDate < ds.asOf ? Math.max(3, Math.round(lt?.avgDelayDays ?? 5)) : daysBetween(ds.asOf, x.po.expectedDate),
      qty: x.qty,
    }));

    const available = Math.max(0, inv.onHand - inv.allocated);
    const inventoryPosition = available + openPoQty;
    const daysOfStock = dailyDemand > 0 ? round(available / dailyDemand, 1) : null;

    const horizon = effectiveLeadTimeDays + POLICY.reviewCoverDays;
    const stockoutDay = projectStockout(available, dailyDemand, receipts, horizon);
    const projectedStockoutDate = stockoutDay !== undefined ? addDays(ds.asOf, Math.floor(stockoutDay)) : undefined;

    let stockoutRisk: RiskLevel = "none";
    if (stockoutDay !== undefined && forecastWeekly >= 0.5) {
      if (stockoutDay <= effectiveLeadTimeDays) stockoutRisk = "high"; // a new order today can't arrive in time
      else if (stockoutDay <= effectiveLeadTimeDays + POLICY.stockoutHorizonBufferDays) stockoutRisk = "medium";
      else stockoutRisk = "low";
    }

    const stockoutBeforeNextCycle = stockoutDay !== undefined && stockoutDay <= effectiveLeadTimeDays + POLICY.stockoutHorizonBufferDays;
    const needsReorder = forecastWeekly >= 0.25 && (inventoryPosition <= reorderPoint || stockoutBeforeNextCycle);
    let recommendedOrderQty = 0;
    if (needsReorder) {
      const orderUpTo = reorderPoint + dailyDemand * POLICY.reviewCoverDays;
      const raw = Math.max(0, orderUpTo - inventoryPosition);
      recommendedOrderQty = Math.max(product.moq, Math.ceil(raw / product.orderMultiple) * product.orderMultiple);
    }

    const lastSaleDate = ds.lastSaleDates[product.id];
    const daysSinceLastSale = lastSaleDate ? daysBetween(lastSaleDate, ds.asOf) : null;
    const weeksOfCover = forecastWeekly > 0 ? inv.onHand / forecastWeekly : inv.onHand > 0 ? null : 0;
    const excessThreshold = Math.ceil(forecastWeekly * POLICY.excessCoverWeeks) + safetyStock;
    const excessQty = Math.max(0, inv.onHand - excessThreshold);

    const isDead = inv.onHand > 0 && (daysSinceLastSale === null || daysSinceLastSale >= POLICY.deadDaysSinceSale);
    const isSlow = inv.onHand > 0 && !isDead && ((daysSinceLastSale ?? 0) >= POLICY.slowDaysSinceSale || (velocity13 < 0.5 && inv.onHand > 0 && (weeksOfCover ?? 999) > 52));

    let status: StockStatus = "healthy";
    if (stockoutRisk === "high") status = "critical";
    else if (needsReorder) status = "reorder";
    else if (stockoutRisk === "medium") status = "at_risk";
    else if (isDead) status = "dead";
    else if (isSlow) status = "slow";
    else if (excessQty > 0) status = "excess";

    const sales12mQty = sum(h);
    return {
      product,
      supplier,
      warehouse,
      onHand: inv.onHand,
      available,
      inventoryValue: round(inv.onHand * product.unitCost, 2),
      weeklyVelocity: round(weeklyVelocity, 1),
      velocity13: round(velocity13, 1),
      velocityPrior13: round(velocityPrior13, 1),
      demandChangePct,
      demandTrend,
      forecastWeekly: round(forecastWeekly, 1),
      weeklyStdDev: round(weeklyStdDev, 1),
      daysOfStock,
      openPoQty,
      nextPoDate: openLines[0]?.po.expectedDate,
      nextPoNumber: openLines[0]?.po.poNumber,
      effectiveLeadTimeDays,
      safetyStock,
      reorderPoint,
      inventoryPosition,
      needsReorder,
      recommendedOrderQty,
      recommendedOrderValue: round(recommendedOrderQty * product.unitCost, 2),
      projectedStockoutDate,
      daysUntilStockout: stockoutDay !== undefined ? round(stockoutDay, 1) : undefined,
      stockoutRisk,
      daysSinceLastSale,
      lastSaleDate,
      excessQty,
      excessValue: round(excessQty * product.unitCost, 2),
      weeksOfCover: weeksOfCover === null ? null : round(weeksOfCover, 1),
      isSeasonal: detectSeasonality(h),
      hasSpike: detectSpike(h),
      status,
      sales12mQty,
      sales12mRevenue: round(revenueByProduct.get(product.id) ?? 0, 2),
    } satisfies ProductMetrics;
  });
}

export interface InventoryHealth {
  totalValue: number;
  totalUnits: number;
  skuCount: number;
  excessValue: number;
  slowValue: number;
  deadValue: number;
  reorderCount: number;
  reorderValue: number;
  stockoutHigh: number;
  stockoutMedium: number;
  increasingDemand: number;
  decliningDemand: number;
  turnover: number;
  healthyPct: number;
  byStatus: Record<StockStatus, { count: number; value: number }>;
  byCategory: { category: string; value: number; excessValue: number; skus: number; atRisk: number }[];
  byWarehouse: { warehouseId: string; name: string; value: number; skus: number; atRisk: number }[];
}

export function computeInventoryHealth(metrics: ProductMetrics[]): InventoryHealth {
  const byStatus = {} as InventoryHealth["byStatus"];
  for (const s of ["critical", "reorder", "at_risk", "healthy", "excess", "slow", "dead"] as StockStatus[]) byStatus[s] = { count: 0, value: 0 };
  for (const m of metrics) {
    byStatus[m.status].count++;
    byStatus[m.status].value += m.inventoryValue;
  }
  const totalValue = sum(metrics.map((m) => m.inventoryValue));
  const cogs12m = sum(metrics.map((m) => m.sales12mQty * m.product.unitCost));
  const cats = [...new Set(metrics.map((m) => m.product.category))];
  const whs = [...new Map(metrics.map((m) => [m.warehouse.id, m.warehouse])).values()];
  const atRisk = (m: ProductMetrics) => m.stockoutRisk === "high" || m.stockoutRisk === "medium";
  return {
    totalValue,
    totalUnits: sum(metrics.map((m) => m.onHand)),
    skuCount: metrics.length,
    excessValue: sum(metrics.map((m) => (m.status === "dead" ? m.inventoryValue : m.excessValue))),
    slowValue: byStatus.slow.value,
    deadValue: byStatus.dead.value,
    reorderCount: metrics.filter((m) => m.needsReorder).length,
    reorderValue: sum(metrics.map((m) => m.recommendedOrderValue)),
    stockoutHigh: metrics.filter((m) => m.stockoutRisk === "high").length,
    stockoutMedium: metrics.filter((m) => m.stockoutRisk === "medium").length,
    increasingDemand: metrics.filter((m) => m.demandTrend === "increasing").length,
    decliningDemand: metrics.filter((m) => m.demandTrend === "declining").length,
    turnover: totalValue > 0 ? cogs12m / totalValue : 0,
    healthyPct: metrics.length ? byStatus.healthy.count / metrics.length : 0,
    byStatus,
    byCategory: cats
      .map((c) => {
        const ms = metrics.filter((m) => m.product.category === c);
        return {
          category: c,
          value: sum(ms.map((m) => m.inventoryValue)),
          excessValue: sum(ms.map((m) => (m.status === "dead" ? m.inventoryValue : m.excessValue))),
          skus: ms.length,
          atRisk: ms.filter(atRisk).length,
        };
      })
      .sort((a, b) => b.value - a.value),
    byWarehouse: whs.map((w) => {
      const ms = metrics.filter((m) => m.warehouse.id === w.id);
      return { warehouseId: w.id, name: w.name, value: sum(ms.map((m) => m.inventoryValue)), skus: ms.length, atRisk: ms.filter(atRisk).length };
    }),
  };
}

export const STATUS_META: Record<StockStatus, { label: string; tone: "red" | "amber" | "orange" | "green" | "blue" | "slate" | "violet" }> = {
  critical: { label: "Stockout risk", tone: "red" },
  reorder: { label: "Reorder", tone: "amber" },
  at_risk: { label: "At risk", tone: "orange" },
  healthy: { label: "Healthy", tone: "green" },
  excess: { label: "Excess", tone: "violet" },
  slow: { label: "Slow moving", tone: "blue" },
  dead: { label: "Dead stock", tone: "slate" },
};
