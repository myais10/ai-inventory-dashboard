import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { LinkTabs, PageHeader } from "@/components/ui";
import { InventoryTable, type InventoryRow } from "@/components/app/inventory-table";
import { fmtNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "All Products" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const recByProduct = new Map<string, (typeof ws.recommendations)[number]>();
  for (const r of ws.recommendations) if (r.productId && !recByProduct.has(r.productId)) recByProduct.set(r.productId, r);

  const rows: InventoryRow[] = ws.metrics.map((m) => {
    const rec = recByProduct.get(m.product.id);
    let action = "No action";
    if (m.needsReorder) action = `Order ${fmtNumber(m.recommendedOrderQty)}`;
    else if (m.status === "excess") action = "Reduce stock";
    else if (m.status === "slow" || m.status === "dead") action = "Liquidate / return";
    return {
      id: m.product.id,
      sku: m.product.sku,
      name: m.product.name,
      category: m.product.category,
      warehouse: m.warehouse.name,
      supplier: m.supplier.name,
      stock: m.onHand,
      value: m.inventoryValue,
      velocity: m.weeklyVelocity,
      daysOfStock: m.daysOfStock,
      trend: m.demandTrend,
      trendPct: m.demandChangePct,
      risk: m.stockoutRisk,
      status: m.status,
      action,
      actionHref: rec ? `/recommendations/${rec.id}` : undefined,
    };
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Inventory" description={`${ws.metrics.length} active SKUs across ${ws.dataset.warehouses.length} warehouses`} />
      <LinkTabs active="/inventory" tabs={[{ href: "/inventory", label: "All Products" }, { href: "/inventory/health", label: "Inventory Health" }]} />
      <InventoryTable rows={rows} initialStatus={sp.status} />
    </div>
  );
}
