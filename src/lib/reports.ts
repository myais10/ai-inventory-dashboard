export const REPORTS = [
  { slug: "weekly-inventory", title: "Weekly Inventory Report", description: "Management summary of inventory health, risks, demand changes and recommended actions.", cadence: "Every Monday" },
  { slug: "reorder", title: "Reorder Report", description: "SKUs at or below reorder point with recommended quantities, grouped by supplier.", cadence: "Daily" },
  { slug: "stockout-risk", title: "Stockout Risk Report", description: "Products projected to run out before replenishment, with expected dates and actions.", cadence: "Daily" },
  { slug: "excess-inventory", title: "Excess Inventory Report", description: "Excess, slow-moving and dead stock with capital tied up and release plans.", cadence: "Monthly" },
  { slug: "lost-demand", title: "Lost Demand Report", description: "Items customers requested that you don't stock, with estimated lost sales.", cadence: "Monthly" },
] as const;

export type ReportSlug = (typeof REPORTS)[number]["slug"];
