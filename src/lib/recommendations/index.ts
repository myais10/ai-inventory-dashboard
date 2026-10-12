// Recommendation engine: turns deterministic metrics into prioritised, explainable actions.
// Quantities and dollar impacts are computed here — never by an LLM.

import type {
  LostDemandItem,
  Priority,
  ProductMetrics,
  Recommendation,
  RecommendationStatus,
  RecommendationType,
  SupplierMetrics,
} from "@/lib/types";
import { addDays, daysBetween, fmtCurrency, fmtDate, fmtNumber, fmtPct, fmtWeeks, hashString, round } from "@/lib/utils";

export const TYPE_META: Record<RecommendationType, { label: string; short: string }> = {
  reorder: { label: "Reorder", short: "Reorder" },
  stockout_risk: { label: "Stockout Risk", short: "Stockout" },
  excess_stock: { label: "Excess Stock", short: "Excess" },
  slow_stock: { label: "Slow Stock", short: "Slow" },
  lost_demand: { label: "Lost Demand", short: "Lost demand" },
  supplier_issue: { label: "Supplier Issue", short: "Supplier" },
};

export const STATUS_LABEL: Record<RecommendationStatus, string> = {
  new: "New",
  in_review: "In review",
  approved: "Approved",
  dismissed: "Dismissed",
  completed: "Completed",
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function seededStatus(id: string): RecommendationStatus {
  const h = hashString(id) % 100;
  if (h < 74) return "new";
  if (h < 88) return "in_review";
  if (h < 96) return "approved";
  return "completed";
}

function createdAt(asOf: string, id: string) {
  return addDays(asOf, -(hashString(id) % 4));
}

function productFacts(m: ProductMetrics) {
  return [
    { label: "Current stock", value: `${fmtNumber(m.onHand)} ${m.product.uom}` },
    { label: "Weekly demand", value: fmtNumber(m.forecastWeekly, 1) },
    { label: "Supplier lead time", value: `${m.effectiveLeadTimeDays} days` },
    { label: "Open PO", value: m.openPoQty ? `${fmtNumber(m.openPoQty)} · due ${fmtDate(m.nextPoDate)}` : "None" },
  ];
}

export function generateRecommendations(
  asOf: string,
  metrics: ProductMetrics[],
  lostDemand: LostDemandItem[],
  supplierMetrics: SupplierMetrics[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const m of metrics) {
    const p = m.product;
    const base = { productId: p.id, sku: p.sku, supplierId: p.supplierId, category: p.category, warehouseId: p.warehouseId };
    const dailyRevenue = (m.forecastWeekly / 7) * p.unitPrice;

    // ----- Stockout risk -----
    if (m.stockoutRisk === "high") {
      const id = `rec-stockout-${p.sku.toLowerCase()}`;
      const sd = m.daysUntilStockout ?? 0;
      const poArrives = m.nextPoDate ? daysBetween(asOf, m.nextPoDate) : undefined;
      const replenishDay = poArrives !== undefined && poArrives > sd ? poArrives : m.effectiveLeadTimeDays;
      const gapDays = Math.max(1, Math.round(replenishDay - sd));
      const revenueAtRisk = round(dailyRevenue * gapDays);
      const expedite = poArrives !== undefined && poArrives > sd;
      const orderQty = m.recommendedOrderQty;
      const action = expedite
        ? `Expedite ${m.nextPoNumber} (due ${fmtDate(m.nextPoDate)})${orderQty ? ` and order ${fmtNumber(orderQty)} units` : ""}`
        : `Order ${fmtNumber(orderQty || p.moq)} units now${m.effectiveLeadTimeDays > 10 ? " — request expedited shipping" : ""}`;
      recs.push({
        ...base,
        id,
        type: "stockout_risk",
        priority: "high",
        status: seededStatus(id),
        createdAt: createdAt(asOf, id),
        title: p.name,
        issue: `Projected stockout ${fmtDate(m.projectedStockoutDate)} — ${fmtNumber(sd, 1)} days of cover vs ${m.effectiveLeadTimeDays}-day lead time`,
        recommendation: action,
        impactValue: revenueAtRisk,
        impactLabel: `${fmtCurrency(revenueAtRisk)} revenue at risk`,
        suggestedQty: orderQty || p.moq,
        facts: [...productFacts(m), { label: "Expected stockout", value: fmtDate(m.projectedStockoutDate) }],
        reasoning: [
          `At the forecast rate of ${fmtNumber(m.forecastWeekly, 1)} units/week, available stock of ${fmtNumber(m.available)} lasts ${fmtNumber(sd, 1)} days.`,
          expedite
            ? `The next receipt (${m.nextPoNumber}, ${fmtNumber(m.openPoQty)} units) is due ${fmtDate(m.nextPoDate)} — ${Math.round(poArrives! - sd)} days after projected stockout.`
            : `No open purchase order covers the gap; a new order placed today arrives in ~${m.effectiveLeadTimeDays} days.`,
          `Estimated ${gapDays} days without stock, putting ${fmtCurrency(revenueAtRisk)} of sales at risk.`,
          m.demandTrend === "increasing" ? `Demand is up ${fmtPct(m.demandChangePct, 0)} versus the prior 13 weeks.` : `Demand is ${m.demandTrend} versus the prior 13 weeks.`,
        ],
      });
      continue;
    }

    // ----- Reorder -----
    if (m.needsReorder) {
      const id = `rec-reorder-${p.sku.toLowerCase()}`;
      const sd = m.daysUntilStockout;
      const urgent = m.stockoutRisk === "medium";
      const protectedRevenue = round(m.recommendedOrderQty * p.unitPrice);
      recs.push({
        ...base,
        id,
        type: "reorder",
        priority: urgent ? "high" : sd !== undefined && sd <= m.effectiveLeadTimeDays + 21 ? "medium" : "low",
        status: seededStatus(id),
        createdAt: createdAt(asOf, id),
        title: p.name,
        issue: urgent
          ? `Stock runs out ${fmtDate(m.projectedStockoutDate)} — order now to arrive before stockout`
          : `Inventory position ${fmtNumber(m.inventoryPosition)} is at or below reorder point ${fmtNumber(m.reorderPoint)}`,
        recommendation: `Order ${fmtNumber(m.recommendedOrderQty)} units from ${m.supplier.name}`,
        impactValue: protectedRevenue,
        impactLabel: `${fmtCurrency(m.recommendedOrderValue)} PO · protects ${fmtCurrency(protectedRevenue)} sales`,
        suggestedQty: m.recommendedOrderQty,
        facts: [...productFacts(m), { label: "Reorder point", value: fmtNumber(m.reorderPoint) }],
        reasoning: [
          `Reorder point = lead-time demand (${fmtNumber((m.forecastWeekly / 7) * m.effectiveLeadTimeDays)}) + safety stock (${fmtNumber(m.safetyStock)}) = ${fmtNumber(m.reorderPoint)}.`,
          `Inventory position (on hand ${fmtNumber(m.available)} + on order ${fmtNumber(m.openPoQty)}) is ${fmtNumber(m.inventoryPosition)}.`,
          `Order quantity covers lead time plus 4 weeks of demand, rounded to the ${fmtNumber(p.orderMultiple)}-unit MOQ.`,
          sd !== undefined ? `Without action, stock runs out around ${fmtDate(m.projectedStockoutDate)}.` : `Stock remains above zero in the planning horizon, but will fall below safety stock.`,
        ],
      });
      continue;
    }

    // ----- Slow / dead -----
    if (m.status === "dead" || m.status === "slow") {
      const id = `rec-slow-${p.sku.toLowerCase()}`;
      const dead = m.status === "dead";
      recs.push({
        ...base,
        id,
        type: "slow_stock",
        priority: m.inventoryValue > 10000 ? "high" : m.inventoryValue > 2500 ? "medium" : "low",
        status: seededStatus(id),
        createdAt: createdAt(asOf, id),
        title: p.name,
        issue: dead
          ? `No sales in ${m.daysSinceLastSale ?? "365+"} days — ${fmtCurrency(m.inventoryValue)} tied up`
          : `Last sale ${m.daysSinceLastSale} days ago — ${fmtWeeks(m.weeksOfCover)} of cover`,
        recommendation: dead ? "Return to supplier or liquidate; stop replenishment" : "Run promotion to key accounts; pause replenishment",
        impactValue: round(m.inventoryValue * (dead ? 0.6 : 0.4)),
        impactLabel: `${fmtCurrency(m.inventoryValue * (dead ? 0.6 : 0.4))} cash recoverable`,
        facts: [
          { label: "Current stock", value: `${fmtNumber(m.onHand)} ${p.uom}` },
          { label: "Inventory value", value: fmtCurrency(m.inventoryValue) },
          { label: "Days since last sale", value: m.daysSinceLastSale === null ? "No sales" : String(m.daysSinceLastSale) },
          { label: "13-week velocity", value: `${fmtNumber(m.velocity13, 1)}/wk` },
        ],
        reasoning: [
          `${fmtNumber(m.onHand)} units (${fmtCurrency(m.inventoryValue)}) on hand with ${fmtNumber(m.velocity13, 1)} units/week sold over the last 13 weeks.`,
          m.lastSaleDate ? `Last sale was on ${fmtDate(m.lastSaleDate, true)}.` : "No sales recorded in the last 12 months.",
          dead ? "Recovery estimate assumes ~60% of cost via supplier return or liquidation." : "Recovery estimate assumes ~40% sell-through at a discount over the next quarter.",
        ],
      });
      continue;
    }

    // ----- Excess -----
    if (m.status === "excess" && m.excessValue > 500) {
      const id = `rec-excess-${p.sku.toLowerCase()}`;
      recs.push({
        ...base,
        id,
        type: "excess_stock",
        priority: m.excessValue > 15000 ? "high" : m.excessValue > 5000 ? "medium" : "low",
        status: seededStatus(id),
        createdAt: createdAt(asOf, id),
        title: p.name,
        issue: `${fmtWeeks(m.weeksOfCover)} of cover — ${fmtNumber(m.excessQty)} units above 26-week target`,
        recommendation: m.openPoQty > 0 ? "Cancel or defer open PO; transfer excess to other branches" : "Pause replenishment; transfer or return excess units",
        impactValue: round(m.excessValue),
        impactLabel: `${fmtCurrency(m.excessValue)} excess capital`,
        facts: [
          { label: "Current stock", value: `${fmtNumber(m.onHand)} ${p.uom}` },
          { label: "Weekly demand", value: fmtNumber(m.forecastWeekly, 1) },
          { label: "Cover", value: fmtWeeks(m.weeksOfCover) },
          { label: "Excess value", value: fmtCurrency(m.excessValue) },
        ],
        reasoning: [
          `Target maximum is 26 weeks of forecast demand plus safety stock (${fmtNumber(m.onHand - m.excessQty)} units).`,
          `${fmtNumber(m.excessQty)} units above target at ${fmtCurrency(p.unitCost, true)} cost each = ${fmtCurrency(m.excessValue)}.`,
          m.demandTrend === "declining" ? `Demand has declined ${fmtPct(Math.abs(m.demandChangePct))} versus the prior 13 weeks.` : `Demand is ${m.demandTrend}; current stock far exceeds expected sales.`,
        ],
      });
    }
  }

  // ----- Lost demand -----
  for (const l of lostDemand) {
    if (l.stocked || l.requests < 3) continue;
    const id = `rec-lost-${l.itemKey}`;
    recs.push({
      id,
      type: "lost_demand",
      itemKey: l.itemKey,
      category: l.category,
      priority: l.estimatedLostSales > 15000 || (l.trend === "increasing" && l.requests >= 8) ? "high" : l.estimatedLostSales > 5000 ? "medium" : "low",
      status: seededStatus(id),
      createdAt: createdAt(asOf, id),
      title: l.item,
      issue: `${l.requests} requests from ${l.customers} customers in 12 months — not stocked`,
      recommendation: l.recommendation,
      impactValue: l.estimatedLostSales,
      impactLabel: `${fmtCurrency(l.estimatedLostSales)} lost sales (12 mo)`,
      facts: [
        { label: "Requests", value: String(l.requests) },
        { label: "Quotes issued", value: String(l.quotes) },
        { label: "Customers", value: String(l.customers) },
        { label: "Last requested", value: fmtDate(l.lastRequested) },
      ],
      reasoning: [
        `${l.requests} enquiries (${l.quotes} quoted) for ${fmtNumber(l.totalQty)} units in total over the last 12 months.`,
        `${l.requestsLast90} requests in the last 90 days vs ${l.requestsPrior90} in the prior 90 — demand is ${l.trend}.`,
        `Lost sales are valued at the quoted price (avg ${fmtCurrency(l.avgPrice, true)}).`,
      ],
    });
  }

  // ----- Supplier issues -----
  for (const s of supplierMetrics) {
    const issues: string[] = [];
    if (s.onTimeRate < 0.8) issues.push(`${fmtPct(s.onTimeRate)} on-time delivery`);
    if (s.avgLeadTimeDays > s.quotedLeadTimeDays * 1.15) issues.push(`lead time ${fmtNumber(s.avgLeadTimeDays, 1)}d vs ${s.quotedLeadTimeDays}d quoted`);
    if (s.priceChangePct > 0.05) issues.push(`costs ${fmtPct(s.priceChangePct, 1, true)} in 6 months`);
    if (s.delayedPos > 0) issues.push(`${s.delayedPos} overdue PO${s.delayedPos > 1 ? "s" : ""}`);
    if (!issues.length) continue;
    const id = `rec-supplier-${s.supplier.code.toLowerCase()}`;
    const priceImpact = s.priceChangePct > 0.05 ? s.spend12m * s.priceChangePct : 0;
    const impact = round(Math.max(priceImpact, s.openPoValue));
    recs.push({
      id,
      type: "supplier_issue",
      supplierId: s.supplier.id,
      priority: (s.onTimeRate < 0.75 && s.atRiskSkus > 0) || s.delayedPos >= 2 ? "high" : issues.length >= 2 ? "medium" : "low",
      status: seededStatus(id),
      createdAt: createdAt(asOf, id),
      title: s.supplier.name,
      issue: issues.join(" · ").replace(/^./, (c) => c.toUpperCase()),
      recommendation:
        s.priceChangePct > 0.05 && s.onTimeRate >= 0.8
          ? "Renegotiate pricing or request quotes from alternate suppliers"
          : `Increase planning lead time to ${Math.ceil(s.avgLeadTimeDays)} days; escalate overdue POs${s.dependency === "high" ? "; qualify a second source" : ""}`,
      impactValue: impact,
      impactLabel: priceImpact > s.openPoValue ? `${fmtCurrency(priceImpact)} annual cost increase` : `${fmtCurrency(s.openPoValue)} open PO value`,
      facts: [
        { label: "On-time delivery", value: fmtPct(s.onTimeRate) },
        { label: "Avg lead time", value: `${fmtNumber(s.avgLeadTimeDays, 1)} days` },
        { label: "Quoted lead time", value: `${s.quotedLeadTimeDays} days` },
        { label: "SKUs at risk", value: String(s.atRiskSkus) },
      ],
      reasoning: [
        `${s.receivedPos} purchase orders received in the last 12 months; ${fmtPct(s.onTimeRate)} arrived on time.`,
        `Average actual lead time ${fmtNumber(s.avgLeadTimeDays, 1)} days vs ${s.quotedLeadTimeDays} days quoted${s.avgDelayDays ? `; late orders averaged ${fmtNumber(s.avgDelayDays, 1)} days late` : ""}.`,
        `Supplier accounts for ${fmtPct(s.revenueShare, 1)} of revenue across ${s.skuCount} SKUs (${s.dependency} dependency).`,
      ],
    });
  }

  return recs.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.impactValue - a.impactValue);
}
