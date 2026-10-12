import "server-only";
import type { Dataset, RecommendationStatus } from "@/lib/types";

// In-memory tenant store used in demo mode (no Supabase). Keyed by company id so tenants stay isolated.
// Data lives for the lifetime of the server process; Supabase mode persists to Postgres instead.

export interface ImportRecord {
  id: string;
  fileName: string;
  createdAt: string;
  rows: number;
  imported: number;
  errors: number;
  status: "completed" | "failed";
  kind: string;
}

interface TenantState {
  importedDataset?: Dataset;
  recommendationStatus: Map<string, RecommendationStatus>;
  imports: ImportRecord[];
  companyDetails?: { industry?: string; currency?: string; warehouses?: number; erp?: string };
}

const g = globalThis as unknown as { __aiiDemoStore?: Map<string, TenantState> };
const store = (g.__aiiDemoStore ??= new Map<string, TenantState>());

export function tenant(companyId: string): TenantState {
  let t = store.get(companyId);
  if (!t) {
    t = { recommendationStatus: new Map(), imports: [] };
    store.set(companyId, t);
  }
  return t;
}
