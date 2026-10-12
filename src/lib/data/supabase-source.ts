import "server-only";
import type { Dataset, PurchaseOrder, SalesWeek } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, daysBetween, todayISO } from "@/lib/utils";

// Loads a tenant's raw data from Postgres. Every query runs with the user's JWT, so RLS
// guarantees only rows for companies the user belongs to are returned; the explicit
// company_id filter selects the active workspace.

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => Number(v ?? 0);

export async function loadSupabaseDataset(companyId: string): Promise<Dataset | null> {
  const sb = await createSupabaseServerClient();
  const asOf = todayISO();
  const since = addDays(asOf, -364);

  const [company, warehouses, suppliers, categories, products, inventory, saleLines, pos, prices, enquiries] = await Promise.all([
    sb.from("companies").select("*").eq("id", companyId).single(),
    sb.from("warehouses").select("*").eq("company_id", companyId),
    sb.from("suppliers").select("*").eq("company_id", companyId),
    sb.from("categories").select("id, name").eq("company_id", companyId),
    sb.from("products").select("*").eq("company_id", companyId).eq("status", "active"),
    sb.from("inventory").select("*").eq("company_id", companyId),
    sb.from("sale_lines").select("product_id, qty, unit_price, sales!inner(order_date)").eq("company_id", companyId).gte("sales.order_date", since),
    sb.from("purchase_orders").select("*, purchase_order_lines(*)").eq("company_id", companyId),
    sb.from("supplier_products").select("*").eq("company_id", companyId),
    sb.from("sales_enquiries").select("*").eq("company_id", companyId).gte("enquiry_date", since),
  ]);
  if (company.error || !company.data) return null;

  const c = company.data as Row;
  const catName = new Map((categories.data ?? []).map((r: Row) => [str(r.id), str(r.name)]));
  const defaultWh = str((warehouses.data ?? [])[0]?.id);
  const defaultSup = str((suppliers.data ?? [])[0]?.id);

  // Aggregate sale lines into 52 weekly buckets ending today.
  const weekStarts = Array.from({ length: 52 }, (_, i) => addDays(asOf, -7 * (52 - i)));
  const buckets = new Map<string, SalesWeek>();
  const lastSale: Record<string, string | undefined> = {};
  for (const r of (saleLines.data ?? []) as Row[]) {
    const date = str((r.sales as Row | null)?.order_date);
    const idx = Math.floor(daysBetween(weekStarts[0], date) / 7);
    if (idx < 0 || idx > 51) continue;
    const pid = str(r.product_id);
    const key = `${pid}|${idx}`;
    const b = buckets.get(key) ?? { productId: pid, weekStart: weekStarts[idx], qty: 0, revenue: 0, orders: 0 };
    b.qty += num(r.qty);
    b.revenue += num(r.qty) * num(r.unit_price);
    b.orders += 1;
    buckets.set(key, b);
    if (!lastSale[pid] || date > lastSale[pid]!) lastSale[pid] = date;
  }
  const productRows = (products.data ?? []) as Row[];
  const salesWeeks: SalesWeek[] = [];
  for (const p of productRows) {
    weekStarts.forEach((w, i) => salesWeeks.push(buckets.get(`${str(p.id)}|${i}`) ?? { productId: str(p.id), weekStart: w, qty: 0, revenue: 0, orders: 0 }));
  }

  return {
    asOf,
    company: {
      id: companyId,
      name: str(c.name),
      slug: str(c.slug),
      industry: str(c.industry),
      currency: str(c.currency) || "USD",
      timezone: str(c.timezone),
      trialStart: str(c.trial_start).slice(0, 10),
      trialEnd: str(c.trial_end).slice(0, 10),
      trialStatus: (str(c.trial_status) || "active") as Dataset["company"]["trialStatus"],
      plan: (str(c.plan) || "trial") as Dataset["company"]["plan"],
    },
    warehouses: ((warehouses.data ?? []) as Row[]).map((w) => ({ id: str(w.id), code: str(w.code), name: str(w.name), city: str(w.city), state: str(w.state) })),
    suppliers: ((suppliers.data ?? []) as Row[]).map((s) => ({
      id: str(s.id), code: str(s.code), name: str(s.name), contactName: str(s.contact_name), email: str(s.email), country: str(s.country),
      quotedLeadTimeDays: num(s.quoted_lead_time_days), paymentTerms: str(s.payment_terms),
    })),
    products: productRows.map((p) => ({
      id: str(p.id), sku: str(p.sku), name: str(p.name), category: catName.get(str(p.category_id)) ?? "Uncategorized", brand: str(p.brand),
      supplierId: str(p.primary_supplier_id) || defaultSup, warehouseId: str(p.default_warehouse_id) || defaultWh, uom: str(p.uom) || "ea",
      unitCost: num(p.unit_cost), unitPrice: num(p.unit_price), moq: Math.max(1, num(p.moq)), orderMultiple: Math.max(1, num(p.order_multiple)),
      leadTimeDays: num(p.lead_time_days) || 14, safetyStockOverride: p.safety_stock_override === null ? undefined : num(p.safety_stock_override),
      status: "active" as const,
    })),
    inventory: ((inventory.data ?? []) as Row[]).map((i) => ({ productId: str(i.product_id), warehouseId: str(i.warehouse_id), onHand: num(i.on_hand), allocated: num(i.allocated) })),
    salesWeeks,
    lastSaleDates: lastSale,
    purchaseOrders: ((pos.data ?? []) as Row[]).map(
      (po): PurchaseOrder => ({
        id: str(po.id), poNumber: str(po.po_number), supplierId: str(po.supplier_id), warehouseId: str(po.warehouse_id) || defaultWh,
        status: (str(po.status) === "draft" ? "open" : str(po.status)) as PurchaseOrder["status"],
        orderDate: str(po.order_date), expectedDate: str(po.expected_date) || str(po.order_date), receivedDate: po.received_date ? str(po.received_date) : undefined,
        lines: ((po.purchase_order_lines as Row[]) ?? []).map((l) => ({ productId: str(l.product_id), qty: num(l.qty), qtyReceived: num(l.qty_received), unitCost: num(l.unit_cost) })),
      }),
    ),
    priceHistory: ((prices.data ?? []) as Row[]).map((sp) => ({ supplierId: str(sp.supplier_id), productId: str(sp.product_id), date: str(sp.effective_date), unitCost: num(sp.unit_cost) })),
    enquiries: ((enquiries.data ?? []) as Row[]).map((e) => ({
      id: str(e.id), date: str(e.enquiry_date), customer: str(e.customer_name), requestedItem: str(e.requested_item), itemKey: str(e.item_key),
      productId: e.product_id ? str(e.product_id) : undefined, category: str(e.category), qty: num(e.qty), quotedPrice: num(e.quoted_price),
      quoted: Boolean(e.quoted), outcome: str(e.outcome) as Dataset["enquiries"][number]["outcome"],
    })),
  };
}
