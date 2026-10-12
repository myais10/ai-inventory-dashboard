// AI explanation layer (placeholder implementation).
// Produces a plain-English summary of a recommendation strictly from the engine's facts.
// Swap the body for an LLM call later; pass `rec.facts` + `rec.reasoning` as grounded context
// and instruct the model to restate — never recalculate — the numbers.

import type { Recommendation } from "@/lib/types";

export function explainRecommendation(rec: Recommendation): string {
  const facts = Object.fromEntries(rec.facts.map((f) => [f.label, f.value]));
  switch (rec.type) {
    case "stockout_risk":
      return `${rec.title} is selling faster than it can be replenished. With ${facts["Current stock"]} on hand and weekly demand of ${facts["Weekly demand"]}, stock runs out on ${facts["Expected stockout"]} — before a new order could arrive given the ${facts["Supplier lead time"]} lead time. Acting today limits the gap and protects customer orders.`;
    case "reorder":
      return `${rec.title} has reached its reorder point. Ordering now keeps stock above safety levels through the ${facts["Supplier lead time"]} supplier lead time and covers roughly four further weeks of demand. The quantity is rounded to the supplier's minimum order.`;
    case "excess_stock":
      return `${rec.title} has far more stock than demand requires (${facts["Cover"]} of cover). Holding it ties up ${facts["Excess value"]} of working capital. Pausing replenishment, transferring units or negotiating a return would release that cash.`;
    case "slow_stock":
      return `${rec.title} has barely moved — ${facts["Days since last sale"]} days since the last sale with ${facts["Inventory value"]} on the shelf. The longer it sits, the less it is likely to recover.`;
    case "lost_demand":
      return `Customers asked for ${rec.title} ${facts["Requests"]} times (${facts["Customers"]} different customers), but it isn't stocked. Each request sent elsewhere is revenue — and potentially a customer relationship — lost to a competitor.`;
    case "supplier_issue":
      return `${rec.title} is underperforming: ${facts["On-time delivery"]} on-time delivery and ${facts["Avg lead time"]} average lead time versus ${facts["Quoted lead time"]} quoted. ${facts["SKUs at risk"]} SKUs from this supplier currently carry stockout risk. Planning with realistic lead times prevents future shortages.`;
  }
}
