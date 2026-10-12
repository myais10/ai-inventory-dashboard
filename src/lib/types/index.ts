// Core domain types shared by the data layer, deterministic engines and UI.
// All dates are ISO day strings (YYYY-MM-DD) to keep server/client rendering stable.

export type Role = "owner" | "admin" | "manager" | "viewer";
export type TrialStatus = "active" | "expired" | "converted";

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string;
  currency: string;
  timezone: string;
  trialStart: string;
  trialEnd: string;
  trialStatus: TrialStatus;
  plan: "trial" | "starter" | "growth" | "enterprise";
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  country: string;
  quotedLeadTimeDays: number;
  paymentTerms: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  supplierId: string;
  warehouseId: string;
  uom: string;
  unitCost: number;
  unitPrice: number;
  moq: number;
  orderMultiple: number;
  leadTimeDays: number;
  safetyStockOverride?: number;
  status: "active" | "discontinued";
}

export interface InventoryRecord {
  productId: string;
  warehouseId: string;
  onHand: number;
  allocated: number;
}

export interface SalesWeek {
  productId: string;
  weekStart: string;
  qty: number;
  revenue: number;
  orders: number;
}

export interface PurchaseOrderLine {
  productId: string;
  qty: number;
  qtyReceived: number;
  unitCost: number;
}

export type PurchaseOrderStatus = "open" | "partial" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string;
  receivedDate?: string;
  lines: PurchaseOrderLine[];
}

export interface SupplierPricePoint {
  supplierId: string;
  productId: string;
  date: string;
  unitCost: number;
}

export type EnquiryOutcome = "won" | "lost_no_stock" | "lost_price" | "open";

export interface SalesEnquiry {
  id: string;
  date: string;
  customer: string;
  requestedItem: string;
  itemKey: string;
  productId?: string;
  category: string;
  qty: number;
  quotedPrice: number;
  quoted: boolean;
  outcome: EnquiryOutcome;
}

export interface Dataset {
  asOf: string;
  company: Company;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  products: Product[];
  inventory: InventoryRecord[];
  salesWeeks: SalesWeek[];
  lastSaleDates: Record<string, string | undefined>;
  purchaseOrders: PurchaseOrder[];
  priceHistory: SupplierPricePoint[];
  enquiries: SalesEnquiry[];
}

// ---------- Engine outputs ----------

export type RiskLevel = "high" | "medium" | "low" | "none";
export type DemandTrend = "increasing" | "stable" | "declining";
export type StockStatus =
  | "critical"
  | "reorder"
  | "at_risk"
  | "healthy"
  | "excess"
  | "slow"
  | "dead";

export interface ProductMetrics {
  product: Product;
  supplier: Supplier;
  warehouse: Warehouse;
  onHand: number;
  available: number;
  inventoryValue: number;
  weeklyVelocity: number; // avg last 8 weeks
  velocity13: number;
  velocityPrior13: number;
  demandChangePct: number;
  demandTrend: DemandTrend;
  forecastWeekly: number;
  weeklyStdDev: number;
  daysOfStock: number | null;
  openPoQty: number;
  nextPoDate?: string;
  nextPoNumber?: string;
  effectiveLeadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  inventoryPosition: number;
  needsReorder: boolean;
  recommendedOrderQty: number;
  recommendedOrderValue: number;
  projectedStockoutDate?: string;
  daysUntilStockout?: number;
  stockoutRisk: RiskLevel;
  daysSinceLastSale: number | null;
  lastSaleDate?: string;
  excessQty: number;
  excessValue: number;
  weeksOfCover: number | null;
  isSeasonal: boolean;
  hasSpike: boolean;
  status: StockStatus;
  sales12mQty: number;
  sales12mRevenue: number;
}

export type RecommendationType =
  | "reorder"
  | "stockout_risk"
  | "excess_stock"
  | "slow_stock"
  | "lost_demand"
  | "supplier_issue";

export type Priority = "high" | "medium" | "low";
export type RecommendationStatus =
  | "new"
  | "in_review"
  | "approved"
  | "dismissed"
  | "completed";

export interface RecommendationFact {
  label: string;
  value: string;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  priority: Priority;
  status: RecommendationStatus;
  createdAt: string;
  productId?: string;
  sku?: string;
  supplierId?: string;
  itemKey?: string;
  title: string;
  issue: string;
  recommendation: string;
  impactValue: number;
  impactLabel: string;
  suggestedQty?: number;
  facts: RecommendationFact[];
  reasoning: string[];
  category?: string;
  warehouseId?: string;
}

export interface LostDemandItem {
  itemKey: string;
  item: string;
  category: string;
  stocked: boolean;
  productId?: string;
  requests: number;
  quotes: number;
  customers: number;
  totalQty: number;
  estimatedLostSales: number;
  firstRequested: string;
  lastRequested: string;
  requestsLast90: number;
  requestsPrior90: number;
  trend: DemandTrend;
  avgPrice: number;
  recommendation: string;
  monthly: number[];
}

export interface SupplierMetrics {
  supplier: Supplier;
  skuCount: number;
  quotedLeadTimeDays: number;
  avgLeadTimeDays: number;
  onTimeRate: number;
  avgDelayDays: number;
  receivedPos: number;
  openPos: number;
  delayedPos: number;
  openPoValue: number;
  spend12m: number;
  priceChangePct: number;
  revenueShare: number;
  atRiskSkus: number;
  dependency: "high" | "medium" | "low";
  leadTimeHistory: { month: string; days: number }[];
}
