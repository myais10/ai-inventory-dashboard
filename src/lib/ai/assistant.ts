// Inventory assistant — AI EXPLANATION LAYER.
// It never computes purchasing numbers itself: answers are composed only from the
// deterministic engine output (Workspace). Today this is a rule-based composer; an LLM can
// later be dropped in behind `answerQuestion` and given the same structured context
// (see buildAssistantContext) with instructions to cite, not invent, numbers.

import type { Workspace } from "@/lib/data/workspace";
import type { ProductMetrics } from "@/lib/types";
import { fmtCompactCurrency, fmtCurrency, fmtDate, fmtNumber, fmtPct, mean, sum } from "@/lib/utils";

export interface AssistantAnswer {
  answer: string;
  bullets: string[];
  links: { label: string; href: string }[];
}

const CATEGORY_WORDS: [RegExp, string][] = [
  [/bearing/, "Bearings"],
  [/belt|sprocket|chain|coupling|power transmission/, "Power Transmission"],
  [/filter|hydraulic|hose/, "Hydraulics & Filtration"],
  [/pump/, "Pumps"],
  [/valve/, "Valves"],
  [/hvac|thermostat|capacitor|actuator/, "HVAC"],
  [/electric|breaker|contactor|relay|sensor/, "Electrical"],
  [/fastener|bolt|nut|screw|washer|anchor/, "Fasteners"],
  [/safety|glove|respirator|mask|ppe|glasses/, "Safety"],
  [/grease|lubric|oil/, "Lubrication"],
];

function detectCategory(q: string) {
  return CATEGORY_WORDS.find(([re]) => re.test(q))?.[1];
}

const atRisk = (m: ProductMetrics) => m.stockoutRisk === "high" || m.stockoutRisk === "medium";

export function answerQuestion(ws: Workspace, question: string): AssistantAnswer {
  const q = question.toLowerCase();
  const category = detectCategory(q);
  const scope = category ? ws.metrics.filter((m) => m.product.category === category) : ws.metrics;
  const scopeLabel = category ? category.replace(/s$/, "").toLowerCase() : "";

  const sku = ws.metrics.find((m) => q.includes(m.product.sku.toLowerCase()) || q.includes(m.product.sku.toLowerCase().replace(/-/g, " ")));
  if (sku) {
    const m = sku;
    return {
      answer: `${m.product.name} has ${fmtNumber(m.onHand)} units on hand (${fmtNumber(m.daysOfStock, 1)} days of stock) against forecast demand of ${fmtNumber(m.forecastWeekly, 1)}/week.`,
      bullets: [
        `Supplier ${m.supplier.name}, effective lead time ${m.effectiveLeadTimeDays} days.`,
        m.projectedStockoutDate ? `Projected stockout ${fmtDate(m.projectedStockoutDate)} (${m.stockoutRisk} risk).` : "No stockout projected in the planning horizon.",
        m.needsReorder ? `Recommended order: ${fmtNumber(m.recommendedOrderQty)} units (${fmtCurrency(m.recommendedOrderValue)}).` : "No reorder required right now.",
        m.openPoQty ? `${fmtNumber(m.openPoQty)} units on order, next due ${fmtDate(m.nextPoDate)}.` : "No open purchase orders.",
      ],
      links: [{ label: `Open ${m.product.sku}`, href: `/products/${encodeURIComponent(m.product.sku)}` }],
    };
  }

  if (/stock ?out|run(ning)? out|shortage|risk/.test(q)) {
    const risky = scope.filter(atRisk).sort((a, b) => (a.daysUntilStockout ?? 99) - (b.daysUntilStockout ?? 99));
    if (!risky.length) return { answer: `No ${scopeLabel} SKUs are currently projected to stock out within lead time.`, bullets: [], links: [{ label: "Inventory health", href: "/inventory/health" }] };
    const increasing = risky.filter((m) => m.demandTrend === "increasing").length;
    const avgLt = mean(risky.map((m) => m.effectiveLeadTimeDays));
    const longLt = risky.filter((m) => m.effectiveLeadTimeDays > m.product.leadTimeDays).length;
    const reasons: string[] = [];
    if (increasing) reasons.push(`increased demand on ${increasing} of them`);
    reasons.push(`supplier lead times averaging ${fmtNumber(avgLt)} days`);
    if (longLt) reasons.push(`${longLt} where actual lead times exceed quoted`);
    return {
      answer: `${risky.length} ${scopeLabel} SKU${risky.length > 1 ? "s have" : " has"} elevated stockout risk. The primary drivers are ${reasons.join(", ")}.`,
      bullets: risky.slice(0, 5).map((m) => `${m.product.name} — stockout ${fmtDate(m.projectedStockoutDate)}, ${fmtNumber(m.daysOfStock, 1)} days of cover vs ${m.effectiveLeadTimeDays}-day lead time.`),
      links: [{ label: "View stockout risks", href: "/recommendations/stockout-risk" }],
    };
  }

  if (/reorder|order|buy|purchas/.test(q)) {
    const list = scope.filter((m) => m.needsReorder).sort((a, b) => b.recommendedOrderValue - a.recommendedOrderValue);
    return {
      answer: `${list.length} ${scopeLabel} SKU${list.length === 1 ? "" : "s"} need reordering, totalling ${fmtCurrency(sum(list.map((m) => m.recommendedOrderValue)))} at cost.`,
      bullets: list.slice(0, 5).map((m) => `${m.product.name}: order ${fmtNumber(m.recommendedOrderQty)} (${fmtCurrency(m.recommendedOrderValue)}) from ${m.supplier.name}.`),
      links: [{ label: "Open reorder list", href: "/recommendations/reorder" }],
    };
  }

  if (/excess|slow|dead|overstock|cash|tied/.test(q)) {
    const list = scope.filter((m) => m.status === "excess" || m.status === "slow" || m.status === "dead");
    const value = sum(list.map((m) => (m.status === "excess" ? m.excessValue : m.inventoryValue)));
    return {
      answer: `${fmtCompactCurrency(value)} is tied up in ${list.length} excess, slow or dead ${scopeLabel} SKUs.`,
      bullets: list
        .sort((a, b) => b.inventoryValue - a.inventoryValue)
        .slice(0, 5)
        .map((m) => `${m.product.name} — ${fmtCurrency(m.inventoryValue)} on hand, ${m.daysSinceLastSale ?? "no"} days since last sale.`),
      links: [{ label: "Review excess & slow stock", href: "/recommendations/excess" }],
    };
  }

  if (/lost|don.?t stock|not stock|asking|enquir|request/.test(q)) {
    const items = ws.lostDemand.filter((l) => !l.stocked && (!category || l.category === category));
    return {
      answer: `Customers requested ${items.length} items you don't stock, worth an estimated ${fmtCurrency(sum(items.map((l) => l.estimatedLostSales)))} in lost sales over 12 months.`,
      bullets: items.slice(0, 5).map((l) => `${l.item} — ${l.requests} requests from ${l.customers} customers (${l.trend}).`),
      links: [{ label: "Open lost demand", href: "/recommendations/lost-demand" }],
    };
  }

  if (/supplier|vendor|late|lead time|delay|reliab/.test(q)) {
    const named = ws.suppliers.find((s) => q.includes(s.supplier.name.split(" ")[0].toLowerCase()));
    const list = named ? [named] : [...ws.suppliers].sort((a, b) => a.onTimeRate - b.onTimeRate).slice(0, 4);
    return {
      answer: named
        ? `${named.supplier.name} delivered ${fmtPct(named.onTimeRate)} of POs on time with an average lead time of ${fmtNumber(named.avgLeadTimeDays, 1)} days (quoted ${named.quotedLeadTimeDays}).`
        : `Your least reliable suppliers by on-time delivery are listed below.`,
      bullets: list.map(
        (s) => `${s.supplier.name}: ${fmtPct(s.onTimeRate)} on time, ${fmtNumber(s.avgLeadTimeDays, 1)}d avg lead time, ${s.delayedPos} overdue PO${s.delayedPos === 1 ? "" : "s"}, ${s.atRiskSkus} SKUs at risk.`,
      ),
      links: [{ label: "Supplier performance", href: "/suppliers/performance" }],
    };
  }

  if (/demand|trend|grow|increas|declin|season/.test(q)) {
    const up = scope.filter((m) => m.demandTrend === "increasing").sort((a, b) => b.demandChangePct - a.demandChangePct);
    const down = scope.filter((m) => m.demandTrend === "declining");
    return {
      answer: `${up.length} ${scopeLabel} SKUs show increasing demand and ${down.length} are declining (last 13 weeks vs prior 13).`,
      bullets: up.slice(0, 5).map((m) => `${m.product.name}: ${fmtPct(m.demandChangePct, 0, true)} (${fmtNumber(m.velocity13, 1)}/wk).`),
      links: [{ label: "Demand trends", href: "/demand/trends" }],
    };
  }

  const h = ws.health;
  return {
    answer: `You hold ${fmtCompactCurrency(h.totalValue)} of inventory across ${h.skuCount} SKUs. ${h.stockoutHigh} SKUs will stock out before replenishment can arrive, ${h.reorderCount} need reordering and ${fmtCompactCurrency(h.excessValue)} is excess.`,
    bullets: ["Try: “Why are we at risk of running out of bearings?”", "“What should I reorder this week?”", "“Which suppliers are late?”", "“What are customers asking for that we don't stock?”"],
    links: [{ label: "Go to dashboard", href: "/dashboard" }],
  };
}

/** Structured, numbers-of-record context to hand an LLM in the future. */
export function buildAssistantContext(ws: Workspace) {
  return {
    asOf: ws.dataset.asOf,
    kpis: ws.kpis,
    topRecommendations: ws.recommendations.slice(0, 25).map((r) => ({ type: r.type, priority: r.priority, title: r.title, issue: r.issue, action: r.recommendation, impact: r.impactLabel })),
  };
}
