// Demand intelligence: trends, seasonality, spikes, aggregate forecast and lost demand.

import type { Dataset, LostDemandItem, ProductMetrics } from "@/lib/types";
import { forecastDemand } from "@/lib/forecasting";
import { addDays, daysBetween, fmtDate, mean, round, sum } from "@/lib/utils";

export interface DemandSeriesPoint {
  week: string;
  label: string;
  actual?: number;
  forecast?: number;
  lower?: number;
  upper?: number;
}

/** Aggregate weekly revenue-at-cost demand (units are not additive across SKUs, dollars are). */
export function aggregateDemandSeries(ds: Dataset, filter?: (productId: string) => boolean, horizon = 12): DemandSeriesPoint[] {
  const productIds = new Set(ds.products.filter((p) => !filter || filter(p.id)).map((p) => p.id));
  const costById = new Map(ds.products.map((p) => [p.id, p.unitCost]));
  const byWeek = new Map<string, number>();
  for (const s of ds.salesWeeks) {
    if (!productIds.has(s.productId)) continue;
    byWeek.set(s.weekStart, (byWeek.get(s.weekStart) ?? 0) + s.qty * (costById.get(s.productId) ?? 0));
  }
  const weeks = [...byWeek.keys()].sort();
  const values = weeks.map((w) => byWeek.get(w)!);
  const fc = forecastDemand(values, horizon);
  const resid = values.slice(-13).map((v) => v - mean(values.slice(-13)));
  const sd = Math.sqrt(mean(resid.map((r) => r * r)));
  const points: DemandSeriesPoint[] = weeks.map((w, i) => ({ week: w, label: fmtDate(w), actual: round(values[i]) }));
  // connect forecast line to last actual
  points[points.length - 1].forecast = points[points.length - 1].actual;
  const lastWeek = weeks[weeks.length - 1];
  fc.forecast.forEach((f, i) => {
    const w = addDays(lastWeek, 7 * (i + 1));
    const band = sd * Math.sqrt(1 + i * 0.15);
    points.push({ week: w, label: fmtDate(w), forecast: round(f), lower: round(Math.max(0, f - band)), upper: round(f + band) });
  });
  return points;
}

export function productDemandSeries(ds: Dataset, productId: string, horizon = 8): DemandSeriesPoint[] {
  const rows = ds.salesWeeks.filter((s) => s.productId === productId).sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  const values = rows.map((r) => r.qty);
  const fc = forecastDemand(values, horizon);
  const points: DemandSeriesPoint[] = rows.map((r) => ({ week: r.weekStart, label: fmtDate(r.weekStart), actual: r.qty }));
  if (!rows.length) return points;
  points[points.length - 1].forecast = points[points.length - 1].actual;
  const last = rows[rows.length - 1].weekStart;
  fc.forecast.forEach((f, i) => {
    const w = addDays(last, 7 * (i + 1));
    points.push({ week: w, label: fmtDate(w), forecast: round(f, 1) });
  });
  return points;
}

export function demandMovers(metrics: ProductMetrics[]) {
  const active = metrics.filter((m) => m.velocity13 + m.velocityPrior13 >= 2);
  const increasing = active
    .filter((m) => m.demandTrend === "increasing")
    .sort((a, b) => b.demandChangePct - a.demandChangePct);
  const declining = active
    .filter((m) => m.demandTrend === "declining")
    .sort((a, b) => a.demandChangePct - b.demandChangePct);
  const seasonal = metrics.filter((m) => m.isSeasonal);
  const spikes = metrics.filter((m) => m.hasSpike);
  const shortageRisk = metrics
    .filter((m) => m.demandTrend === "increasing" && (m.stockoutRisk !== "none" || m.needsReorder))
    .sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999));
  return { increasing, declining, seasonal, spikes, shortageRisk };
}

export function categoryDemand(ds: Dataset, metrics: ProductMetrics[]) {
  const cats = [...new Set(metrics.map((m) => m.product.category))];
  return cats
    .map((c) => {
      const ms = metrics.filter((m) => m.product.category === c);
      const cur = sum(ms.map((m) => m.velocity13 * m.product.unitCost));
      const prior = sum(ms.map((m) => m.velocityPrior13 * m.product.unitCost));
      const fc = sum(ms.map((m) => m.forecastWeekly * m.product.unitCost));
      return { category: c, weeklyValue: cur, priorWeeklyValue: prior, changePct: prior > 0 ? cur / prior - 1 : 0, forecastWeeklyValue: fc, skus: ms.length };
    })
    .sort((a, b) => b.weeklyValue - a.weeklyValue);
}

/** Customer requests for items we don't stock, or couldn't supply. */
export function computeLostDemand(ds: Dataset): LostDemandItem[] {
  const groups = new Map<string, typeof ds.enquiries>();
  for (const e of ds.enquiries) {
    const unstocked = !e.productId;
    if (!unstocked && e.outcome !== "lost_no_stock") continue;
    if (!groups.has(e.itemKey)) groups.set(e.itemKey, []);
    groups.get(e.itemKey)!.push(e);
  }
  const d90 = addDays(ds.asOf, -90);
  const d180 = addDays(ds.asOf, -180);
  const items: LostDemandItem[] = [];
  for (const [key, es] of groups) {
    const stocked = !!es[0].productId;
    const lost = es.filter((e) => e.outcome === "lost_no_stock");
    const last90 = es.filter((e) => e.date >= d90).length;
    const prior90 = es.filter((e) => e.date < d90 && e.date >= d180).length;
    const ratio = prior90 > 0 ? last90 / prior90 : last90 > 0 ? 2 : 1;
    const trend = ratio > 1.25 ? "increasing" : ratio < 0.8 ? "declining" : "stable";
    const customers = new Set(es.map((e) => e.customer)).size;
    const dates = es.map((e) => e.date).sort();
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const start = addDays(ds.asOf, -30 * (12 - i));
      const end = addDays(ds.asOf, -30 * (11 - i));
      return es.filter((e) => e.date >= start && e.date < end).length;
    });
    const totalQty = sum(es.map((e) => e.qty));
    const avgPrice = mean(es.map((e) => e.quotedPrice));
    const estimatedLostSales = round(sum(lost.map((e) => e.qty * e.quotedPrice)));
    const monthsSpan = Math.max(1, daysBetween(dates[0], ds.asOf) / 30);
    const monthlyQty = totalQty / monthsSpan;

    let recommendation: string;
    if (stocked) recommendation = "Raise safety stock — demand lost to stockouts";
    else if (es.length >= 8 && customers >= 4) recommendation = `Add to range — stock ~${Math.max(1, Math.ceil(monthlyQty * 2))} units (≈8 weeks demand)`;
    else if (es.length >= 5 && trend !== "declining") {
      const n = Math.max(1, Math.ceil(monthlyQty));
      recommendation = `Trial stock — ${n} unit${n === 1 ? "" : "s"}, review in 60 days`;
    }
    else if (es.length >= 3) recommendation = "Source on demand — set up supplier for drop-ship";
    else recommendation = "Monitor enquiries";

    items.push({
      itemKey: key,
      item: es[0].requestedItem,
      category: es[0].category,
      stocked,
      productId: es[0].productId,
      requests: es.length,
      quotes: es.filter((e) => e.quoted).length,
      customers,
      totalQty,
      estimatedLostSales,
      firstRequested: dates[0],
      lastRequested: dates[dates.length - 1],
      requestsLast90: last90,
      requestsPrior90: prior90,
      trend,
      avgPrice: round(avgPrice, 2),
      recommendation,
      monthly,
    });
  }
  return items.sort((a, b) => b.estimatedLostSales - a.estimatedLostSales);
}
