import { NextResponse } from "next/server";
import { generateNorthstarDataset } from "@/lib/mock/generate";
import { addDays, todayISO } from "@/lib/utils";

// Sample CSV files (generated fresh so dates are always recent) for trying the import flow.
// Each file intentionally includes a couple of bad rows so validation can be seen working.

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(esc).join(",")).join("\n");

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const ds = generateNorthstarDataset(todayISO());
  const prod = new Map(ds.products.map((p) => [p.id, p]));
  const sup = new Map(ds.suppliers.map((s) => [s.id, s.name]));
  const wh = new Map(ds.warehouses.map((w) => [w.id, w.name]));
  let body: string;

  switch (name) {
    case "inventory.csv": {
      const rows: (string | number)[][] = [["Item Number", "Description", "Category", "Qty On Hand", "Unit Cost", "Unit Price", "Warehouse", "Vendor", "Lead Time Days", "MOQ"]];
      for (const inv of ds.inventory) {
        const p = prod.get(inv.productId)!;
        rows.push([p.sku, p.name, p.category, inv.onHand, p.unitCost, p.unitPrice, wh.get(inv.warehouseId)!, sup.get(p.supplierId)!, p.leadTimeDays, p.moq]);
      }
      rows.push([ds.products[0].sku, ds.products[0].name, ds.products[0].category, 5, ds.products[0].unitCost, ds.products[0].unitPrice, wh.get(ds.products[0].warehouseId)!, sup.get(ds.products[0].supplierId)!, 14, 50]); // duplicate
      rows.push(["", "Unlabelled bin item", "Fasteners", "12", "abc", "", "Chicago DC", "", "", ""]); // missing SKU + bad cost
      body = csv(rows);
      break;
    }
    case "sales.csv": {
      const rows: (string | number)[][] = [["SKU", "Invoice Date", "Qty Sold"]];
      for (const s of ds.salesWeeks) if (s.qty > 0) rows.push([prod.get(s.productId)!.sku, addDays(s.weekStart, 3) > ds.asOf ? addDays(ds.asOf, -1) : addDays(s.weekStart, 3), s.qty]);
      rows.push(["SKF-6205-2RS", "31/31/2026", 4]); // invalid date
      rows.push(["GAT-A48", addDays(ds.asOf, -3), "ten"]); // invalid quantity
      body = csv(rows);
      break;
    }
    case "purchase_orders.csv": {
      const rows: (string | number)[][] = [["PO Number", "SKU", "Vendor", "Qty Ordered", "Expected Date"]];
      for (const po of ds.purchaseOrders.filter((x) => x.status === "open"))
        for (const l of po.lines) rows.push([po.poNumber, prod.get(l.productId)!.sku, sup.get(po.supplierId)!, l.qty, po.expectedDate]);
      body = csv(rows);
      break;
    }
    case "enquiries.csv": {
      const rows: (string | number)[][] = [["Enquiry Date", "Customer", "SKU", "Description", "Qty", "Unit Price"]];
      for (const e of ds.enquiries.filter((x) => !x.productId || x.outcome === "lost_no_stock"))
        rows.push([e.date, e.customer, e.productId ? prod.get(e.productId)!.sku : "", e.requestedItem, e.qty, e.quotedPrice]);
      body = csv(rows);
      break;
    }
    default:
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="northstar-${name}"` } });
}
