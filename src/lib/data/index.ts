import "server-only";
import { cache } from "react";
import type { AppSession } from "@/lib/auth/session";
import { generateNorthstarDataset } from "@/lib/mock/generate";
import { todayISO } from "@/lib/utils";
import { analyseDataset, type Workspace } from "./workspace";
import { tenant } from "./demo-store";
import { loadSupabaseDataset } from "./supabase-source";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecommendationStatus } from "@/lib/types";

export type { Workspace } from "./workspace";

const sampleCache = new Map<string, Workspace>();

function sampleWorkspace(): Workspace {
  const asOf = todayISO();
  let ws = sampleCache.get(asOf);
  if (!ws) {
    sampleCache.clear();
    ws = analyseDataset(generateNorthstarDataset(asOf));
    sampleCache.set(asOf, ws);
  }
  return ws;
}

/**
 * Resolve the analysed workspace for the signed-in tenant.
 * - sample data source → Northstar demo dataset
 * - imported data → tenant's own dataset (in-memory in demo mode, Postgres via RLS in Supabase mode)
 */
export const getWorkspace = cache(async (session: AppSession): Promise<Workspace & { isSample: boolean }> => {
  const company = session.company!;
  let ws: Workspace | null = null;

  if (company.dataSource === "import") {
    if (session.mode === "demo") {
      const ds = tenant(company.id).importedDataset;
      if (ds) ws = analyseDataset({ ...ds, asOf: todayISO() });
    } else {
      const ds = await loadSupabaseDataset(company.id);
      if (ds && ds.products.length) ws = analyseDataset(ds);
    }
  }

  const isSample = !ws;
  ws ??= sampleWorkspace();

  // Apply persisted recommendation status changes for this tenant.
  let overrides: Map<string, RecommendationStatus> = new Map();
  if (session.mode === "demo") overrides = tenant(company.id).recommendationStatus;
  else {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.from("recommendations").select("external_key, status").eq("company_id", company.id);
    overrides = new Map((data ?? []).map((r) => [r.external_key as string, r.status as RecommendationStatus]));
  }
  const recommendations = overrides.size
    ? ws.recommendations.map((r) => (overrides.has(r.id) ? { ...r, status: overrides.get(r.id)! } : r))
    : ws.recommendations;

  return {
    ...ws,
    recommendations,
    dataset: { ...ws.dataset, company: { ...ws.dataset.company, id: company.id, name: company.name } },
    isSample,
  };
});
