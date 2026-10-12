import type { RecRow } from "@/components/app/recommendations-table";
import type { Workspace } from "./workspace";

/** Serializable recommendation rows + filter options for client tables. */
export function recommendationTableProps(ws: Workspace) {
  const supplierName = new Map(ws.dataset.suppliers.map((s) => [s.id, s.name]));
  const whName = new Map(ws.dataset.warehouses.map((w) => [w.id, w.name]));
  const rows: RecRow[] = ws.recommendations.map((r) => ({
    ...r,
    supplierName: r.supplierId ? supplierName.get(r.supplierId) : undefined,
    warehouseName: r.warehouseId ? whName.get(r.warehouseId) : undefined,
  }));
  return {
    rows,
    suppliers: [...supplierName.values()].sort(),
    warehouses: [...whName.values()],
    categories: [...new Set(ws.dataset.products.map((p) => p.category))].sort(),
  };
}
