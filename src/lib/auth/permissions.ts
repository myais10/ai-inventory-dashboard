import type { Role } from "@/lib/types";

export type Permission =
  | "recommendations:update"
  | "data:import"
  | "company:update"
  | "users:manage"
  | "billing:manage"
  | "warehouses:manage";

const MATRIX: Record<Role, Permission[]> = {
  owner: ["recommendations:update", "data:import", "company:update", "users:manage", "billing:manage", "warehouses:manage"],
  admin: ["recommendations:update", "data:import", "company:update", "users:manage", "warehouses:manage"],
  manager: ["recommendations:update", "data:import"],
  viewer: [],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full access including billing and company deletion" },
  admin: { label: "Admin", description: "Manage users, settings, data sources and warehouses" },
  manager: { label: "Manager", description: "Act on recommendations and import data" },
  viewer: { label: "Viewer", description: "Read-only access to dashboards and reports" },
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "recommendations:update": "Approve & dismiss recommendations",
  "data:import": "Import data",
  "company:update": "Edit company settings",
  "users:manage": "Invite & manage users",
  "billing:manage": "Manage billing",
  "warehouses:manage": "Manage warehouses",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];
