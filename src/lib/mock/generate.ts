import type {
  Dataset,
  InventoryRecord,
  Product,
  PurchaseOrder,
  SalesEnquiry,
  SalesWeek,
  Supplier,
  SupplierPricePoint,
} from "@/lib/types";
import { addDays, createRng, hashString, parseISODate, round } from "@/lib/utils";
import { CATALOG, CUSTOMERS, SUPPLIERS, UNSTOCKED_REQUESTS, WAREHOUSES, type CatalogEntry } from "./catalog";

const HISTORY_WEEKS = 52;
const DEMAND_SCALE = 2.2;

function dayOfYear(iso: string) {
  const d = parseISODate(iso);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

function seasonalFactor(profile: CatalogEntry["profile"], weekStart: string) {
  const doy = dayOfYear(weekStart);
  if (profile === "seasonal_summer") return Math.max(0.15, 1 + 0.85 * Math.cos((2 * Math.PI * (doy - 196)) / 365));
  if (profile === "seasonal_winter") return Math.max(0.2, 1 + 0.75 * Math.cos((2 * Math.PI * (doy - 20)) / 365));
  return 1;
}

function trendFactor(profile: CatalogEntry["profile"], w: number) {
  const t = w / (HISTORY_WEEKS - 1);
  switch (profile) {
    case "growing":
      return 0.55 + 0.75 * t * t;
    case "critical":
      return 0.85 + 0.3 * t;
    case "declining":
      return 1.55 - 1.0 * Math.pow(t, 1.4);
    case "slow":
      return w < 30 ? 1 : Math.max(0, 1 - (w - 30) / 10);
    case "dead":
      return w < 22 ? 1 : 0;
    default:
      return 1;
  }
}

function poisson(rng: ReturnType<typeof createRng>, lambda: number) {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * rng.normal()));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L);
  return k - 1;
}

function roundUpTo(qty: number, multiple: number) {
  return Math.max(multiple, Math.ceil(qty / multiple) * multiple);
}

export function generateNorthstarDataset(asOf: string): Dataset {
  const suppliers: Supplier[] = SUPPLIERS.map((s) => ({
    id: `sup-${s.code.toLowerCase()}`,
    code: s.code,
    name: s.name,
    contactName: s.contact,
    email: `${s.contact.split(" ")[0].toLowerCase()}@${s.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}.com`,
    country: s.country,
    quotedLeadTimeDays: s.lead,
    paymentTerms: s.terms,
  }));
  const supplierByCode = new Map(SUPPLIERS.map((s) => [s.code, s]));

  const products: Product[] = [];
  const inventory: InventoryRecord[] = [];
  const salesWeeks: SalesWeek[] = [];
  const lastSaleDates: Record<string, string | undefined> = {};
  const purchaseOrders: PurchaseOrder[] = [];
  const priceHistory: SupplierPricePoint[] = [];
  const enquiries: SalesEnquiry[] = [];
  let poSeq = 24100;
  let enqSeq = 1;

  const weekStarts = Array.from({ length: HISTORY_WEEKS }, (_, i) => addDays(asOf, -7 * (HISTORY_WEEKS - i)));

  for (const raw of CATALOG) {
    // Scale demand to a mid-sized distributor's volume; the hero SKU keeps its documented numbers.
    const entry = raw.sku === "SKF-6205-2RS" ? raw : { ...raw, weekly: raw.weekly * DEMAND_SCALE };
    const prng = createRng(hashString(entry.sku));
    const sup = supplierByCode.get(entry.supplier as (typeof SUPPLIERS)[number]["code"])!;
    const id = `prd-${entry.sku.toLowerCase()}`;
    const markup = entry.category === "Fasteners" ? prng.range(1.6, 1.9) : prng.range(1.32, 1.55);
    const leadTimeDays = sup.lead;
    const product: Product = {
      id,
      sku: entry.sku,
      name: entry.name,
      category: entry.category,
      brand: entry.brand,
      supplierId: `sup-${sup.code.toLowerCase()}`,
      warehouseId: entry.warehouse ?? "wh-chi",
      uom: entry.uom ?? "ea",
      unitCost: entry.cost,
      unitPrice: round(entry.cost * markup, 2),
      moq: entry.moq,
      orderMultiple: entry.moq,
      leadTimeDays,
      status: "active",
    };
    if (entry.sku === "SKF-6205-2RS") product.safetyStockOverride = 20;
    products.push(product);

    // ----- Sales history -----
    const qtys: number[] = [];
    weekStarts.forEach((ws, w) => {
      let lambda = entry.weekly * trendFactor(entry.profile, w) * seasonalFactor(entry.profile, ws);
      if (entry.profile === "spike" && w >= HISTORY_WEEKS - 2) lambda *= w === HISTORY_WEEKS - 1 ? 3.4 : 2.6;
      const noisy = lambda > 30 ? lambda * Math.exp(0.16 * prng.normal()) : lambda;
      const qty = poisson(prng, noisy);
      qtys.push(qty);
      salesWeeks.push({
        productId: id,
        weekStart: ws,
        qty,
        revenue: round(qty * product.unitPrice * prng.range(0.94, 1), 2),
        orders: qty === 0 ? 0 : Math.max(1, Math.round(qty / Math.max(1, prng.range(2, 6)))),
      });
    });
    const lastIdx = qtys.map((q, i) => (q > 0 ? i : -1)).filter((i) => i >= 0).pop();
    lastSaleDates[id] =
      lastIdx === undefined ? undefined : addDays(weekStarts[lastIdx], Math.min(6, prng.int(0, 6)));
    if (lastSaleDates[id] && lastSaleDates[id]! >= asOf) lastSaleDates[id] = addDays(asOf, -1);

    const recent = Math.max(0.1, qtys.slice(-8).reduce((a, b) => a + b, 0) / 8);
    const ltWeeks = leadTimeDays / 7;

    // ----- Inventory position by profile -----
    let onHand: number;
    let openPo: { qty: number; inDays: number } | null = null;
    switch (entry.profile) {
      case "critical":
        onHand = recent * prng.range(0.9, 1.35);
        if (prng.chance(0.55)) openPo = { qty: roundUpTo(recent * 3, entry.moq), inDays: Math.round(leadTimeDays * prng.range(0.75, 1)) };
        break;
      case "reorder":
        onHand = recent * (ltWeeks + prng.range(0.9, 1.7));
        break;
      case "growing":
        onHand = recent * prng.range(3.2, 4.4);
        break;
      case "spike":
        onHand = entry.weekly * prng.range(3.8, 5);
        break;
      case "healthy":
        onHand = recent * (ltWeeks + prng.range(5, 10));
        if (prng.chance(0.35)) openPo = { qty: roundUpTo(recent * 4, entry.moq), inDays: prng.int(3, leadTimeDays) };
        break;
      case "seasonal_winter":
        onHand = recent * prng.range(5, 8);
        if (prng.chance(0.5)) openPo = { qty: roundUpTo(recent * 4, entry.moq), inDays: prng.int(5, leadTimeDays) };
        break;
      case "seasonal_summer":
        onHand = entry.weekly * prng.range(8, 11);
        break;
      case "excess":
        onHand = recent * prng.range(32, 55);
        break;
      case "declining":
        onHand = entry.weekly * prng.range(16, 24);
        break;
      case "slow":
        onHand = entry.weekly * prng.range(10, 18);
        break;
      case "dead":
        onHand = Math.max(12, entry.weekly * prng.range(25, 45));
        break;
    }
    if (entry.sku === "SKF-6205-2RS") {
      onHand = 42;
      openPo = { qty: 100, inDays: 12 };
    }
    onHand = Math.max(0, Math.round(onHand));
    inventory.push({
      productId: id,
      warehouseId: product.warehouseId,
      onHand,
      allocated: Math.min(onHand, Math.round(onHand * prng.range(0, 0.08))),
    });

    // ----- Price history (supplier cost drift) -----
    const drift = sup.price * prng.range(0.6, 1.4);
    for (const daysAgo of [365, 270, 180, 90, 0]) {
      const factor = 1 / (1 + drift * (daysAgo / 180));
      priceHistory.push({ supplierId: product.supplierId, productId: id, date: addDays(asOf, -daysAgo), unitCost: round(entry.cost * factor, 2) });
    }

    // ----- Historical (received) purchase orders -----
    const annual = qtys.reduce((a, b) => a + b, 0);
    if (annual > 0) {
      const lotQty = roundUpTo(Math.max(entry.weekly * 6, 1), entry.moq);
      const receipts = Math.min(10, Math.max(1, Math.round(annual / lotQty)));
      for (let r = 0; r < receipts; r++) {
        const orderDate = addDays(asOf, -Math.round(350 - (r * 320) / receipts) - prng.int(0, 10));
        const expected = addDays(orderDate, leadTimeDays);
        const late = !prng.chance(sup.onTime);
        // SKF lead times have stretched in the last quarter — reflected in recent receipts.
        const extra = sup.code === "SKF" && r >= receipts - 3 ? prng.int(3, 6) : 0;
        const received = late ? addDays(expected, prng.int(sup.delay[0], sup.delay[1]) + extra) : addDays(expected, -prng.int(0, 1) + (extra ? extra : 0));
        if (received >= asOf) continue;
        purchaseOrders.push({
          id: `po-${poSeq}`,
          poNumber: `PO-${poSeq++}`,
          supplierId: product.supplierId,
          warehouseId: product.warehouseId,
          status: "received",
          orderDate,
          expectedDate: expected,
          receivedDate: received,
          lines: [{ productId: id, qty: lotQty, qtyReceived: lotQty, unitCost: round(entry.cost / (1 + drift * (daysBetweenSafe(orderDate, asOf) / 180)), 2) }],
        });
      }
    }

    // ----- Open purchase order -----
    if (openPo) {
      const expected = addDays(asOf, openPo.inDays);
      purchaseOrders.push({
        id: `po-${poSeq}`,
        poNumber: `PO-${poSeq++}`,
        supplierId: product.supplierId,
        warehouseId: product.warehouseId,
        status: "open",
        orderDate: addDays(expected, -leadTimeDays),
        expectedDate: expected,
        lines: [{ productId: id, qty: openPo.qty, qtyReceived: 0, unitCost: entry.cost }],
      });
    }

    // ----- Customer enquiries for stocked items -----
    const enqCount = Math.min(14, Math.round(entry.weekly / 3) + 1);
    for (let i = 0; i < enqCount; i++) {
      const daysAgo = prng.int(1, 360);
      const lostNoStock = (entry.profile === "critical" || entry.profile === "spike") && daysAgo < 30 && prng.chance(0.6);
      const qty = Math.max(1, Math.round(entry.weekly * prng.range(0.2, 0.8)));
      enquiries.push({
        id: `enq-${enqSeq++}`,
        date: addDays(asOf, -daysAgo),
        customer: prng.pick(CUSTOMERS),
        requestedItem: entry.name,
        itemKey: entry.sku.toLowerCase(),
        productId: id,
        category: entry.category,
        qty,
        quotedPrice: product.unitPrice,
        quoted: true,
        outcome: lostNoStock ? "lost_no_stock" : prng.chance(0.78) ? "won" : "lost_price",
      });
    }
  }

  // Overdue open POs at less reliable suppliers.
  const overdue: [string, number, number][] = [
    ["GRU-UPS15-58", 24, 9],
    ["EAT-XTCE018", 20, 6],
    ["ASC-8262H002", 12, 11],
    ["HON-V8043F", 18, 4],
    ["SKF-6207-2Z", 50, 5],
  ];
  for (const [sku, qty, daysLate] of overdue) {
    const p = products.find((x) => x.sku === sku)!;
    purchaseOrders.push({
      id: `po-${poSeq}`,
      poNumber: `PO-${poSeq++}`,
      supplierId: p.supplierId,
      warehouseId: p.warehouseId,
      status: "open",
      orderDate: addDays(asOf, -(p.leadTimeDays + daysLate)),
      expectedDate: addDays(asOf, -daysLate),
      lines: [{ productId: p.id, qty, qtyReceived: 0, unitCost: p.unitCost }],
    });
  }

  // ----- Unstocked item requests (lost demand) -----
  for (const req of UNSTOCKED_REQUESTS) {
    const prng = createRng(hashString(req.key));
    for (let m = 0; m < 12; m++) {
      const lambda = (req.weight / 8) * (1 + ((req.growth - 1) * m) / 11) * (m >= 9 ? 1.15 : 1);
      const n = poisson(prng, lambda);
      for (let i = 0; i < n; i++) {
        const daysAgo = Math.max(1, (11 - m) * 30 + prng.int(0, 29));
        const qty = Math.max(1, Math.round((650 / req.price) * prng.range(0.4, 1.8)));
        const quoted = prng.chance(0.6);
        enquiries.push({
          id: `enq-${enqSeq++}`,
          date: addDays(asOf, -daysAgo),
          customer: prng.pick(CUSTOMERS),
          requestedItem: req.item,
          itemKey: req.key,
          category: req.category,
          qty,
          quotedPrice: req.price,
          quoted,
          outcome: daysAgo < 7 && prng.chance(0.5) ? "open" : "lost_no_stock",
        });
      }
    }
  }

  enquiries.sort((a, b) => (a.date < b.date ? 1 : -1));

  const trialStart = addDays(asOf, -2);
  return {
    asOf,
    company: {
      id: "cmp-northstar",
      name: "Northstar Industrial Supply",
      slug: "northstar",
      industry: "Industrial MRO Distribution",
      currency: "USD",
      timezone: "America/Chicago",
      trialStart,
      trialEnd: addDays(trialStart, 7),
      trialStatus: "active",
      plan: "trial",
    },
    warehouses: WAREHOUSES.map((w) => ({ ...w })),
    suppliers,
    products,
    inventory,
    salesWeeks,
    lastSaleDates,
    purchaseOrders,
    priceHistory,
    enquiries,
  };
}

function daysBetweenSafe(a: string, b: string) {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}
