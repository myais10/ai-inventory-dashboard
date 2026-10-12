import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dataset } from "@/lib/types";
import type { ImportFile, ValidationReport } from "@/lib/import";
import { addDays } from "@/lib/utils";

/**
 * Persist an imported dataset to Postgres under the user's session (RLS enforces tenant + role).
 * Upserts are keyed on natural keys (company_id + code/sku/po_number) so re-imports update in place.
 */
export async function persistImportToSupabase(sb: SupabaseClient, companyId: string, userId: string, ds: Dataset, files: ImportFile[], report: ValidationReport) {
  const fail = (step: string, e: { message: string } | null) => {
    if (e) throw new Error(`${step}: ${e.message}`);
  };

  const { data: imp, error: impErr } = await sb
    .from("data_imports")
    .insert({
      company_id: companyId,
      created_by: userId,
      file_name: files.map((f) => f.fileName).join(", ").slice(0, 250),
      kind: files.length > 1 ? "mixed" : report.files[0]?.kind ?? "inventory",
      status: "processing",
      column_mapping: Object.fromEntries(files.map((f) => [f.fileName, f.mapping])),
      row_count: report.totalRows,
      imported_count: report.validRows,
      error_count: report.errorRows,
    })
    .select("id")
    .single();
  fail("data_imports", impErr);

  if (report.issues.length) {
    await sb.from("data_import_rows").insert(
      report.issues.slice(0, 500).map((i) => ({ company_id: companyId, import_id: imp!.id, row_number: i.row, raw: { file: i.file }, status: i.kind === "duplicate" ? "duplicate" : "error", errors: [{ field: i.field, message: i.message }] })),
    );
  }

  const whRes = await sb.from("warehouses").upsert(ds.warehouses.map((w) => ({ company_id: companyId, code: w.code || w.name.slice(0, 8), name: w.name })), { onConflict: "company_id,code" }).select("id, code");
  fail("warehouses", whRes.error);
  const whId = new Map(ds.warehouses.map((w) => [w.id, whRes.data!.find((r) => r.code === (w.code || w.name.slice(0, 8)))?.id]));

  const supRes = await sb.from("suppliers").upsert(ds.suppliers.map((s) => ({ company_id: companyId, code: s.code, name: s.name, quoted_lead_time_days: s.quotedLeadTimeDays })), { onConflict: "company_id,code" }).select("id, code");
  fail("suppliers", supRes.error);
  const supId = new Map(ds.suppliers.map((s) => [s.id, supRes.data!.find((r) => r.code === s.code)?.id]));

  const cats = [...new Set(ds.products.map((p) => p.category))];
  const catRes = await sb.from("categories").upsert(cats.map((name) => ({ company_id: companyId, name })), { onConflict: "company_id,name" }).select("id, name");
  fail("categories", catRes.error);
  const catId = new Map(catRes.data!.map((c) => [c.name as string, c.id as string]));

  const prodRes = await sb
    .from("products")
    .upsert(
      ds.products.map((p) => ({
        company_id: companyId,
        sku: p.sku,
        name: p.name,
        category_id: catId.get(p.category),
        uom: p.uom,
        unit_cost: p.unitCost,
        unit_price: p.unitPrice,
        moq: p.moq,
        order_multiple: p.orderMultiple,
        lead_time_days: p.leadTimeDays,
        primary_supplier_id: supId.get(p.supplierId),
        default_warehouse_id: whId.get(p.warehouseId),
      })),
      { onConflict: "company_id,sku" },
    )
    .select("id, sku");
  fail("products", prodRes.error);
  const prodId = new Map(ds.products.map((p) => [p.id, prodRes.data!.find((r) => r.sku === p.sku)?.id as string]));

  const invRes = await sb.from("inventory").upsert(
    ds.inventory.map((i) => ({ company_id: companyId, product_id: prodId.get(i.productId), warehouse_id: whId.get(i.warehouseId), on_hand: i.onHand, allocated: i.allocated })),
    { onConflict: "product_id,warehouse_id" },
  );
  fail("inventory", invRes.error);

  // Weekly sales buckets are stored as one sales document per product-week.
  const salesRows = ds.salesWeeks.filter((s) => s.qty > 0);
  for (let i = 0; i < salesRows.length; i += 500) {
    const chunk = salesRows.slice(i, i + 500);
    const sRes = await sb
      .from("sales")
      .upsert(chunk.map((s) => ({ company_id: companyId, order_number: `IMP-${s.weekStart}-${s.productId}`.slice(0, 120), order_date: addDays(s.weekStart, 3), total: s.revenue })), { onConflict: "company_id,order_number" })
      .select("id, order_number");
    fail("sales", sRes.error);
    const sid = new Map(sRes.data!.map((r) => [r.order_number as string, r.id as string]));
    const lRes = await sb.from("sale_lines").insert(
      chunk.map((s) => ({ company_id: companyId, sale_id: sid.get(`IMP-${s.weekStart}-${s.productId}`.slice(0, 120)), product_id: prodId.get(s.productId), qty: s.qty, unit_price: s.qty ? s.revenue / s.qty : 0 })),
    );
    fail("sale_lines", lRes.error);
  }

  for (const po of ds.purchaseOrders) {
    const poRes = await sb
      .from("purchase_orders")
      .upsert({ company_id: companyId, po_number: po.poNumber, supplier_id: supId.get(po.supplierId), warehouse_id: whId.get(po.warehouseId), status: po.status, order_date: po.orderDate, expected_date: po.expectedDate }, { onConflict: "company_id,po_number" })
      .select("id")
      .single();
    fail("purchase_orders", poRes.error);
    await sb.from("purchase_order_lines").delete().eq("purchase_order_id", poRes.data!.id);
    fail("po_lines", (await sb.from("purchase_order_lines").insert(po.lines.map((l) => ({ company_id: companyId, purchase_order_id: poRes.data!.id, product_id: prodId.get(l.productId), qty: l.qty, qty_received: l.qtyReceived, unit_cost: l.unitCost })))).error);
  }

  if (ds.enquiries.length) {
    fail(
      "sales_enquiries",
      (
        await sb.from("sales_enquiries").insert(
          ds.enquiries.map((e) => ({ company_id: companyId, enquiry_date: e.date, customer_name: e.customer, requested_item: e.requestedItem, item_key: e.itemKey, product_id: e.productId ? prodId.get(e.productId) : null, category: e.category, qty: e.qty, quoted_price: e.quotedPrice, quoted: e.quoted, outcome: e.outcome })),
        )
      ).error,
    );
  }

  await sb.from("data_imports").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", imp!.id);
  await sb.from("companies").update({ data_source: "import", onboarding_completed: true }).eq("id", companyId);
  await sb.from("audit_logs").insert({ company_id: companyId, actor_id: userId, action: "data.imported", entity_type: "data_import", entity_id: imp!.id, metadata: { rows: report.validRows } });
}
