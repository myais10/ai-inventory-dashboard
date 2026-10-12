import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Settings,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  children?: { label: string; href: string; badgeKey?: string }[];
  badgeKey?: string;
}

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Recommendations",
    href: "/recommendations",
    icon: Lightbulb,
    badgeKey: "openRecs",
    children: [
      { label: "All recommendations", href: "/recommendations" },
      { label: "Reorder", href: "/recommendations/reorder", badgeKey: "reorder" },
      { label: "Stockout Risk", href: "/recommendations/stockout-risk", badgeKey: "stockout" },
      { label: "Excess & Slow Stock", href: "/recommendations/excess" },
      { label: "Lost Demand", href: "/recommendations/lost-demand" },
    ],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Boxes,
    children: [
      { label: "All Products", href: "/inventory" },
      { label: "Inventory Health", href: "/inventory/health" },
    ],
  },
  {
    label: "Demand",
    href: "/demand",
    icon: TrendingUp,
    children: [
      { label: "Demand Forecast", href: "/demand/forecast" },
      { label: "Demand Trends", href: "/demand/trends" },
      { label: "Lost Demand", href: "/demand/lost-demand" },
    ],
  },
  {
    label: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    children: [
      { label: "Suppliers", href: "/suppliers" },
      { label: "Supplier Performance", href: "/suppliers/performance" },
      { label: "Lead Times", href: "/suppliers/lead-times" },
    ],
  },
  { label: "Reports", href: "/reports", icon: FileText },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { label: "Company", href: "/settings/company" },
      { label: "Users & Permissions", href: "/settings/users" },
      { label: "Data Sources", href: "/settings/data-sources" },
      { label: "Warehouses", href: "/settings/warehouses" },
      { label: "Billing", href: "/settings/billing" },
    ],
  },
];

export const BarIcon = BarChart3;
