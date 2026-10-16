import { BarChart3, Building2, CheckSquare, Columns3, Headphones, Settings, Users, UsersRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  keys: string;
  badgeKey?: "queue" | "tasks" | "unassigned";
  managerOnly?: boolean;
}

export const NAV: NavItem[] = [
  { label: "Calling Desk", href: "/desk", icon: Headphones, keys: "g d", badgeKey: "queue" },
  { label: "Leads", href: "/leads", icon: Users, keys: "g l" },
  { label: "Companies", href: "/companies", icon: Building2, keys: "g c" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, keys: "g t", badgeKey: "tasks" },
  { label: "Pipeline", href: "/pipeline", icon: Columns3, keys: "g p" },
  { label: "Team", href: "/team", icon: UsersRound, keys: "g m", managerOnly: true, badgeKey: "unassigned" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, keys: "g a" },
  { label: "Settings", href: "/settings", icon: Settings, keys: "g s" },
];
