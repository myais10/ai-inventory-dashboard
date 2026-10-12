import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getWorkspace } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { RecommendationTabs } from "@/components/app/rec-tabs";
import { ReorderPlanner, type ReorderRow } from "@/components/app/reorder-planner";
import { fmtCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Reorder" };

export default async function ReorderPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const list = ws.metrics
    .filter((m) => m.needsReorder)
    .sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999));
  const rows: ReorderRow[] = list.map((m) => ({
    productId: m.product.id,
    sku: m.product.sku,
    name: m.product.name,
    supplier: m.supplier.name,
    warehouse: m.warehouse.name,
    onHand: m.onHand,
    onOrder: m.openPoQty,
    weekly: m.forecastWeekly,
    leadTime: m.effectiveLeadTimeDays,
    reorderPoint: m.reorderPoint,
    safetyStock: m.safetyStock,
    qty: m.recommendedOrderQty,
    moq: m.product.moq,
    unitCost: m.product.unitCost,
    stockoutDate: m.projectedStockoutDate,
    risk: m.stockoutRisk,
  }));
  const total = list.reduce((a, m) => a + m.recommendedOrderValue, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reorder intelligence"
        description={`${list.length} SKUs are at or below their reorder point · ${fmtCurrency(total)} recommended purchasing at cost`}
      />
      <RecommendationTabs ws={ws} active="/recommendations/reorder" />
      <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-[12.5px] text-muted">
        <span className="font-medium text-ink">How quantities are calculated: </span>
        reorder point = forecast demand over the effective supplier lead time + safety stock (95% service level). When stock on hand plus on order falls to the
        reorder point, or stock is projected to run out within lead time + 7 days, we order up to lead-time demand + 4 weeks, rounded to the MOQ.
      </div>
      <ReorderPlanner rows={rows} canEdit={can(session.role, "recommendations:update")} />
    </div>
  );
}
