// CSV import: field definitions, auto-mapping, validation and conversion into a Dataset.
// Pure functions — used on the client for instant feedback and re-run on the server
// (the server never trusts client-side validation results).

import type { Dataset, Product, PurchaseOrder, SalesEnquiry, SalesWeek, Supplier, Warehouse } from "@/lib/types";
import { addDays, daysBetween, round, toISODate } from "@/lib/utils";

export type FieldKey =
  | "sku"
  | "productName"
  | "category"
  | "quantity"
  | "unitCost"
  | "unitPrice"
  | "warehouse"
  | "supplier"
  | "leadTimeDays"
  | "moq"
  | "salesDate"
  | "salesQuantity"
  | "purchaseOrder"
  | "poQuantity"
  | "expectedDate"
  | "customer";

export interface FieldDef {
  key: FieldKey;
  label: string;
  type: "string" | "number" | "date";
  synonyms: string[];
  group: "Product" | "Inventory" | "Sales" | "Purchasing" | "Enquiries";
}

export const FIELDS: FieldDef[] = [
  { key: "sku", label: "SKU", type: "string", group: "Product", synonyms: ["sku", "item", "item number", "item no", "part", "part number", "part no", "product code", "code", "item code"] },
  { key: "productName", label: "Product Name", type: "string", group: "Product", synonyms: ["product name", "name", "description", "item description", "product", "title"] },
  { key: "category", label: "Category", type: "string", group: "Product", synonyms: ["category", "product group", "group", "family", "class"] },
  { key: "quantity", label: "Quantity", type: "number", group: "Inventory", synonyms: ["quantity", "qty", "on hand", "qty on hand", "stock", "onhand", "quantity on hand", "available"] },
  { key: "unitCost", label: "Unit Cost", type: "number", group: "Inventory", synonyms: ["unit cost", "cost", "avg cost", "average cost", "standard cost", "unit price cost"] },
  { key: "unitPrice", label: "Unit Price", type: "number", group: "Product", synonyms: ["unit price", "price", "sell price", "list price", "selling price"] },
  { key: "warehouse", label: "Warehouse", type: "string", group: "Inventory", synonyms: ["warehouse", "location", "branch", "site", "whse", "store"] },
  { key: "supplier", label: "Supplier", type: "string", group: "Purchasing", synonyms: ["supplier", "vendor", "manufacturer", "supplier name", "vendor name"] },
  { key: "leadTimeDays", label: "Lead Time (days)", type: "number", group: "Purchasing", synonyms: ["lead time", "lead time days", "leadtime", "lt"] },
  { key: "moq", label: "Minimum Order Qty", type: "number", group: "Purchasing", synonyms: ["moq", "min order qty", "minimum order quantity", "min qty"] },
  { key: "salesDate", label: "Sales Date", type: "date", group: "Sales", synonyms: ["sales date", "date", "invoice date", "order date", "transaction date", "enquiry date", "request date"] },
  { key: "salesQuantity", label: "Sales Quantity", type: "number", group: "Sales", synonyms: ["sales quantity", "sales qty", "qty sold", "quantity sold", "units sold", "sold"] },
  { key: "purchaseOrder", label: "Purchase Order", type: "string", group: "Purchasing", synonyms: ["purchase order", "po", "po number", "po no", "po #", "purchase order number"] },
  { key: "poQuantity", label: "Purchase Order Quantity", type: "number", group: "Purchasing", synonyms: ["po quantity", "po qty", "order qty", "ordered", "qty ordered", "purchase order quantity"] },
  { key: "expectedDate", label: "Expected Delivery Date", type: "date", group: "Purchasing", synonyms: ["expected delivery date", "expected date", "due date", "eta", "delivery date", "promised date"] },
  { key: "customer", label: "Customer / Enquiry", type: "string", group: "Enquiries", synonyms: ["customer", "customer name", "account", "enquiry", "inquiry", "requested by", "client"] },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<FieldKey, FieldDef>;

export type Mapping = Partial<Record<FieldKey, string>>; // field -> CSV header
export type ImportKind = "inventory" | "sales" | "purchase_orders" | "enquiries";

export const KIND_LABEL: Record<ImportKind, string> = {
  inventory: "Inventory & products",
  sales: "Sales history",
  purchase_orders: "Purchase orders",
  enquiries: "Customer enquiries",
};

export const REQUIRED: Record<ImportKind, FieldKey[]> = {
  inventory: ["sku", "quantity"],
  sales: ["sku", "salesDate", "salesQuantity"],
  purchase_orders: ["sku", "purchaseOrder", "poQuantity", "expectedDate"],
  enquiries: ["customer", "salesDate"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-./#]+/g, " ").replace(/\s+/g, " ").trim();

/** Suggest a mapping from CSV headers using exact, then partial synonym matches. */
export function autoMap(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();
  for (const pass of ["exact", "partial"] as const) {
    for (const f of FIELDS) {
      if (mapping[f.key]) continue;
      const h = headers.find((hd) => {
        if (used.has(hd)) return false;
        const n = norm(hd);
        return pass === "exact" ? f.synonyms.includes(n) || n === norm(f.label) : f.synonyms.some((s) => s.length > 3 && n.includes(s));
      });
      if (h) {
        mapping[f.key] = h;
        used.add(h);
      }
    }
  }
  return mapping;
}

export function detectKind(mapping: Mapping): ImportKind {
  if (mapping.purchaseOrder) return "purchase_orders";
  if (mapping.customer && !mapping.salesQuantity) return "enquiries";
  if (mapping.customer && mapping.salesQuantity && !mapping.quantity && !mapping.unitCost) return "sales";
  if (mapping.salesDate && mapping.salesQuantity) return "sales";
  return "inventory";
}

export function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // US M/D/Y
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // EU D.M.Y
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;
  function valid(y: number, mo: number, d: number) {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return toISODate(dt);
  }
}

export interface ImportFile {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Mapping;
}

export interface RowIssue {
  file: string;
  row: number; // 1-based data row (excluding header)
  field?: string;
  message: string;
  kind: "missing" | "invalid" | "duplicate";
}

export interface ValidationReport {
  totalRows: number;
  validRows: number;
  errorRows: number;
  missingFields: { file: string; kind: ImportKind; fields: string[] }[];
  duplicates: number;
  invalidValues: number;
  missingValues: number;
  issues: RowIssue[];
  byKind: Record<ImportKind, number>;
  files: { fileName: string; kind: ImportKind; rows: number; valid: number }[];
}

const val = (row: Record<string, string>, mapping: Mapping, key: FieldKey) => {
  const h = mapping[key];
  return h ? (row[h] ?? "").trim() : "";
};

export function validateImport(files: ImportFile[]): ValidationReport {
  const report: ValidationReport = {
    totalRows: 0,
    validRows: 0,
    errorRows: 0,
    missingFields: [],
    duplicates: 0,
    invalidValues: 0,
    missingValues: 0,
    issues: [],
    byKind: { inventory: 0, sales: 0, purchase_orders: 0, enquiries: 0 },
    files: [],
  };
  // SKUs known from inventory files, used to flag sales/PO rows for unknown products.
  const knownSkus = new Set<string>();
  for (const f of files) if (detectKind(f.mapping) === "inventory" && f.mapping.sku) for (const r of f.rows) knownSkus.add((r[f.mapping.sku] ?? "").trim().toUpperCase());
  for (const f of files) {
    const kind = detectKind(f.mapping);
    const required = REQUIRED[kind];
    const unmapped = required.filter((k) => !f.mapping[k]);
    if (kind === "enquiries" && !f.mapping.sku && !f.mapping.productName) unmapped.push("productName");
    if (unmapped.length) report.missingFields.push({ file: f.fileName, kind, fields: unmapped.map((k) => FIELD_BY_KEY[k].label) });

    const seen = new Set<string>();
    let fileValid = 0;
    f.rows.forEach((row, i) => {
      report.totalRows++;
      const issues: RowIssue[] = [];
      const push = (fieldKey: FieldKey | undefined, message: string, k: RowIssue["kind"]) =>
        issues.push({ file: f.fileName, row: i + 1, field: fieldKey ? FIELD_BY_KEY[fieldKey].label : undefined, message, kind: k });

      if (!unmapped.length) {
        for (const k of required) if (!val(row, f.mapping, k)) push(k, "Required value is empty", "missing");
        if (kind === "enquiries" && !val(row, f.mapping, "sku") && !val(row, f.mapping, "productName")) push("productName", "Enquiry needs a SKU or product name", "missing");
      }
      for (const fd of FIELDS) {
        const raw = val(row, f.mapping, fd.key);
        if (!raw) continue;
        if (fd.type === "number") {
          const n = parseNumber(raw);
          if (n === null) push(fd.key, `“${raw}” is not a number`, "invalid");
          else if (n < 0 && fd.key !== "quantity") push(fd.key, "Cannot be negative", "invalid");
        } else if (fd.type === "date" && !parseDate(raw)) push(fd.key, `“${raw}” is not a valid date (use YYYY-MM-DD or MM/DD/YYYY)`, "invalid");
        else if (fd.type === "string" && raw.length > 200) push(fd.key, "Value is longer than 200 characters", "invalid");
      }
      if ((kind === "sales" || kind === "purchase_orders") && knownSkus.size && !issues.length) {
        const sku = val(row, f.mapping, "sku").toUpperCase();
        if (sku && !knownSkus.has(sku)) push("sku", `Unknown SKU “${sku}” — not found in inventory`, "invalid");
      }
      const key =
        kind === "inventory"
          ? `${val(row, f.mapping, "sku").toUpperCase()}|${val(row, f.mapping, "warehouse").toUpperCase()}`
          : kind === "purchase_orders"
            ? `${val(row, f.mapping, "purchaseOrder")}|${val(row, f.mapping, "sku").toUpperCase()}`
            : null;
      if (key && !issues.length) {
        if (seen.has(key)) push(kind === "inventory" ? "sku" : "purchaseOrder", "Duplicate row — already imported above", "duplicate");
        seen.add(key);
      }

      if (issues.length) {
        report.errorRows++;
        report.duplicates += issues.filter((x) => x.kind === "duplicate").length ? 1 : 0;
        report.invalidValues += issues.filter((x) => x.kind === "invalid").length;
        report.missingValues += issues.filter((x) => x.kind === "missing").length;
        if (report.issues.length < 200) report.issues.push(...issues.slice(0, 200 - report.issues.length));
      } else if (!unmapped.length) {
        report.validRows++;
        fileValid++;
        report.byKind[kind]++;
      }
    });
    report.files.push({ fileName: f.fileName, kind, rows: f.rows.length, valid: unmapped.length ? 0 : fileValid });
  }
  return report;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

/** Convert valid rows of all files into a Dataset for the deterministic engines. Invalid rows are skipped. */
export function buildDatasetFromImport(files: ImportFile[], company: Dataset["company"], asOf: string): Dataset {
  const warehouses = new Map<string, Warehouse>();
  const suppliers = new Map<string, Supplier>();
  const products = new Map<string, Product>();
  const inventory = new Map<string, { productId: string; warehouseId: string; onHand: number; allocated: number }>();
  const sales: { sku: string; date: string; qty: number }[] = [];
  const pos = new Map<string, PurchaseOrder>();
  const enquiries: SalesEnquiry[] = [];

  const wh = (name: string) => {
    const n = name || "Main Warehouse";
    const id = `wh-${slug(n)}`;
    if (!warehouses.has(id)) warehouses.set(id, { id, code: n.slice(0, 3).toUpperCase(), name: n, city: "", state: "" });
    return id;
  };
  const sup = (name: string, lt?: number | null) => {
    const n = name || "Unassigned supplier";
    const id = `sup-${slug(n)}`;
    if (!suppliers.has(id)) suppliers.set(id, { id, code: slug(n).slice(0, 12).toUpperCase(), name: n, contactName: "", email: "", country: "", quotedLeadTimeDays: lt ?? 14, paymentTerms: "" });
    return id;
  };

  const validRows = (f: ImportFile) => {
    const r = validateImport([f]);
    const bad = new Set(r.issues.map((x) => x.row));
    return r.missingFields.length ? [] : f.rows.filter((_, i) => !bad.has(i + 1));
  };

  // Pass 1: products & inventory
  for (const f of files) {
    if (detectKind(f.mapping) !== "inventory") continue;
    for (const row of validRows(f)) {
      const v = (k: FieldKey) => val(row, f.mapping, k);
      const sku = v("sku").toUpperCase();
      const lt = parseNumber(v("leadTimeDays"));
      const cost = parseNumber(v("unitCost")) ?? 0;
      const whId = wh(v("warehouse"));
      if (!products.has(sku)) {
        products.set(sku, {
          id: `prd-${slug(sku)}`,
          sku,
          name: v("productName") || sku,
          category: v("category") || "Uncategorized",
          brand: "",
          supplierId: sup(v("supplier"), lt),
          warehouseId: whId,
          uom: "ea",
          unitCost: cost,
          unitPrice: parseNumber(v("unitPrice")) ?? round(cost * 1.4, 2),
          moq: Math.max(1, Math.round(parseNumber(v("moq")) ?? 1)),
          orderMultiple: Math.max(1, Math.round(parseNumber(v("moq")) ?? 1)),
          leadTimeDays: lt ?? suppliers.get(sup(v("supplier"), lt))!.quotedLeadTimeDays,
          status: "active",
        });
      }
      const p = products.get(sku)!;
      const key = `${p.id}|${whId}`;
      const cur = inventory.get(key) ?? { productId: p.id, warehouseId: whId, onHand: 0, allocated: 0 };
      cur.onHand += parseNumber(v("quantity")) ?? 0;
      inventory.set(key, cur);
    }
  }

  // Pass 2: sales, POs, enquiries
  for (const f of files) {
    const kind = detectKind(f.mapping);
    if (kind === "inventory") continue;
    for (const row of validRows(f)) {
      const v = (k: FieldKey) => val(row, f.mapping, k);
      const sku = v("sku").toUpperCase();
      if (kind === "sales" && products.has(sku)) {
        sales.push({ sku, date: parseDate(v("salesDate"))!, qty: parseNumber(v("salesQuantity")) ?? 0 });
      } else if (kind === "purchase_orders" && products.has(sku)) {
        const p = products.get(sku)!;
        const poNo = v("purchaseOrder");
        const expected = parseDate(v("expectedDate"))!;
        const supplierId = v("supplier") ? sup(v("supplier")) : p.supplierId;
        const po = pos.get(poNo) ?? {
          id: `po-${slug(poNo)}`,
          poNumber: poNo,
          supplierId,
          warehouseId: v("warehouse") ? wh(v("warehouse")) : p.warehouseId,
          status: "open" as const,
          orderDate: addDays(expected, -p.leadTimeDays),
          expectedDate: expected,
          lines: [],
        };
        po.lines.push({ productId: p.id, qty: parseNumber(v("poQuantity")) ?? 0, qtyReceived: 0, unitCost: parseNumber(v("unitCost")) ?? p.unitCost });
        pos.set(poNo, po);
      } else if (kind === "enquiries") {
        const name = v("productName") || sku;
        const p = sku ? products.get(sku) : [...products.values()].find((x) => x.name.toLowerCase() === name.toLowerCase());
        const qty = parseNumber(v("salesQuantity")) ?? parseNumber(v("quantity")) ?? 1;
        const price = parseNumber(v("unitPrice")) ?? p?.unitPrice ?? 0;
        enquiries.push({
          id: `enq-${enquiries.length + 1}`,
          date: parseDate(v("salesDate"))!,
          customer: v("customer"),
          requestedItem: p?.name ?? name,
          itemKey: p ? p.sku.toLowerCase() : slug(name),
          productId: p?.id,
          category: p?.category ?? (v("category") || "Uncategorized"),
          qty,
          quotedPrice: price,
          quoted: price > 0,
          outcome: p ? "won" : "lost_no_stock",
        });
      }
    }
  }

  // Aggregate sales into 52 weekly buckets ending today.
  const weekStarts = Array.from({ length: 52 }, (_, i) => addDays(asOf, -7 * (52 - i)));
  const buckets = new Map<string, number>();
  const lastSale: Record<string, string | undefined> = {};
  for (const s of sales) {
    const idx = Math.floor(daysBetween(weekStarts[0], s.date) / 7);
    if (idx < 0 || idx > 51) continue;
    const pid = products.get(s.sku)!.id;
    buckets.set(`${pid}|${idx}`, (buckets.get(`${pid}|${idx}`) ?? 0) + s.qty);
    if (!lastSale[pid] || s.date > lastSale[pid]!) lastSale[pid] = s.date;
  }
  const salesWeeks: SalesWeek[] = [];
  for (const p of products.values()) {
    weekStarts.forEach((w, i) => {
      const qty = buckets.get(`${p.id}|${i}`) ?? 0;
      salesWeeks.push({ productId: p.id, weekStart: w, qty, revenue: round(qty * p.unitPrice, 2), orders: qty ? 1 : 0 });
    });
  }
  if (!warehouses.size) wh("");

  return {
    asOf,
    company,
    warehouses: [...warehouses.values()],
    suppliers: [...suppliers.values()],
    products: [...products.values()],
    inventory: [...inventory.values()],
    salesWeeks,
    lastSaleDates: lastSale,
    purchaseOrders: [...pos.values()],
    priceHistory: [...products.values()].map((p) => ({ supplierId: p.supplierId, productId: p.id, date: asOf, unitCost: p.unitCost })),
    enquiries,
  };
}
