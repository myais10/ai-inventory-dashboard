import { Activity, BarChart3, Building2, Columns3, PhoneCall, Settings, SquareCheck, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  keys: string;
  badgeKey?: "queue" | "tasks" | "unassigned";
  managerOnly?: boolean;
  group: "Sell" | "Manage" | "Workspace";
}

export const NAV: NavItem[] = [
  { label: "Calling Desk", href: "/desk", icon: PhoneCall, keys: "g d", badgeKey: "queue", group: "Sell" },
  { label: "Leads", href: "/leads", icon: Users, keys: "g l", group: "Sell" },
  { label: "Companies", href: "/companies", icon: Building2, keys: "g c", group: "Sell" },
  { label: "Tasks", href: "/tasks", icon: SquareCheck, keys: "g t", badgeKey: "tasks", group: "Sell" },
  { label: "Pipeline", href: "/pipeline", icon: Columns3, keys: "g p", group: "Sell" },
  { label: "Sales Floor", href: "/sales-floor", icon: Activity, keys: "g f", managerOnly: true, badgeKey: "unassigned", group: "Manage" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, keys: "g a", group: "Manage" },
  { label: "Settings", href: "/settings", icon: Settings, keys: "g s", group: "Workspace" },
];
