// Assembles the full analysed workspace from a raw Dataset by running the deterministic engines.
// The Dataset source (mock or Supabase) is pluggable — see ./source.ts.

import type { Dataset, LostDemandItem, ProductMetrics, Recommendation, SupplierMetrics } from "@/lib/types";
import { computeInventoryHealth, computeProductMetrics, type InventoryHealth } from "@/lib/inventory";
import { computeLeadTimeStats, computeSupplierMetrics } from "@/lib/suppliers";
import { computeLostDemand } from "@/lib/demand";
import { generateRecommendations } from "@/lib/recommendations";
import { sum } from "@/lib/utils";

export interface Workspace {
  dataset: Dataset;
  metrics: ProductMetrics[];
  metricsById: Map<string, ProductMetrics>;
  metricsBySku: Map<string, ProductMetrics>;
  suppliers: SupplierMetrics[];
  lostDemand: LostDemandItem[];
  recommendations: Recommendation[];
  health: InventoryHealth;
  kpis: {
    totalInventory: number;
    reorderRequired: number;
    stockoutRisks: number;
    stockoutWatch: number;
    excessInventory: number;
    lostDemand: number;
    recommendedPurchasing: number;
  };
}

export function analyseDataset(dataset: Dataset): Workspace {
  const leadStats = computeLeadTimeStats(dataset);
  const metrics = computeProductMetrics(dataset, leadStats);
  const suppliers = computeSupplierMetrics(dataset, leadStats, metrics);
  const lostDemand = computeLostDemand(dataset);
  const recommendations = generateRecommendations(dataset.asOf, metrics, lostDemand, suppliers);
  const health = computeInventoryHealth(metrics);
  return {
    dataset,
    metrics,
    metricsById: new Map(metrics.map((m) => [m.product.id, m])),
    metricsBySku: new Map(metrics.map((m) => [m.product.sku.toLowerCase(), m])),
    suppliers,
    lostDemand,
    recommendations,
    health,
    kpis: {
      totalInventory: health.totalValue,
      reorderRequired: health.reorderCount,
      stockoutRisks: health.stockoutHigh,
      stockoutWatch: health.stockoutMedium,
      excessInventory: health.excessValue,
      lostDemand: sum(lostDemand.map((l) => l.estimatedLostSales)),
      recommendedPurchasing: health.reorderValue,
    },
  };
}
