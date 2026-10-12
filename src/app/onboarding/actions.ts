"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, readDemoSessionPayload, writeDemoSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { tenant } from "@/lib/data/demo-store";
import { persistImportToSupabase } from "@/lib/data/supabase-import";
import { buildDatasetFromImport, FIELDS, validateImport, type ImportFile } from "@/lib/import";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";

async function authed() {
  const session = await getSession();
  if (!session?.company) throw new Error("Unauthorized");
  return session as typeof session & { company: NonNullable<typeof session.company> };
}

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(120),
  industry: z.string().trim().max(80),
  warehouses: z.coerce.number().int().min(1).max(500),
  erp: z.string().trim().max(60),
  currency: z.enum(["USD", "CAD", "EUR", "GBP", "AUD"]),
});

export async function saveCompanyDetailsAction(input: z.input<typeof detailsSchema>): Promise<{ ok: boolean; error?: string }> {
  const session = await authed();
  if (!can(session.role, "company:update")) return { ok: false, error: "Only owners and admins can edit company details." };
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (session.mode === "demo") {
    const p = await readDemoSessionPayload();
    if (p) await writeDemoSession({ ...p, companyName: d.name, industry: d.industry });
    tenant(session.company.id).companyDetails = { industry: d.industry, currency: d.currency, warehouses: d.warehouses, erp: d.erp };
  } else {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("companies").update({ name: d.name, industry: d.industry, currency: d.currency }).eq("id", session.company.id);
    if (error) return { ok: false, error: "Could not save company details." };
  }
  return { ok: true };
}

const MAX_ROWS = 100_000;
const fileSchema = z.object({
  fileName: z.string().max(200),
  headers: z.array(z.string().max(200)).max(200),
  rows: z.array(z.record(z.string(), z.string().max(1000))),
  mapping: z.partialRecord(z.enum(FIELDS.map((f) => f.key) as [string, ...string[]]), z.string().max(200)),
});

export interface ImportResult {
  ok: boolean;
  error?: string;
  summary?: { products: number; warehouses: number; suppliers: number; salesWeeks: number; purchaseOrders: number; enquiries: number; validRows: number; errorRows: number };
}

export async function commitImportAction(files: ImportFile[]): Promise<ImportResult> {
  const session = await authed();
  if (!can(session.role, "data:import")) return { ok: false, error: "Your role doesn't allow importing data." };
  const parsed = z.array(fileSchema).min(1).max(10).safeParse(files);
  if (!parsed.success) return { ok: false, error: "Invalid import payload." };
  if (parsed.data.reduce((a, f) => a + f.rows.length, 0) > MAX_ROWS) return { ok: false, error: `Imports are limited to ${MAX_ROWS.toLocaleString()} rows.` };

  const clean = parsed.data as ImportFile[];
  // Server-side validation — never trust the client's report.
  const report = validateImport(clean);
  if (report.byKind.inventory === 0) return { ok: false, error: "At least one valid inventory row (SKU + Quantity) is required." };

  const asOf = todayISO();
  const dataset = buildDatasetFromImport(
    clean,
    {
      id: session.company.id,
      name: session.company.name,
      slug: session.company.id,
      industry: session.company.industry,
      currency: "USD",
      timezone: "America/Chicago",
      trialStart: session.company.trialStart,
      trialEnd: session.company.trialEnd,
      trialStatus: session.company.trialStatus,
      plan: "trial",
    },
    asOf,
  );

  if (session.mode === "demo") {
    const t = tenant(session.company.id);
    t.importedDataset = dataset;
    t.recommendationStatus.clear();
    t.imports.unshift({
      id: `imp-${Date.now()}`,
      fileName: clean.map((f) => f.fileName).join(", "),
      createdAt: new Date().toISOString(),
      rows: report.totalRows,
      imported: report.validRows,
      errors: report.errorRows,
      status: "completed",
      kind: report.files.map((f) => f.kind).join(", "),
    });
    const p = await readDemoSessionPayload();
    if (p) await writeDemoSession({ ...p, dataSource: "import", onboarded: true });
  } else {
    try {
      const sb = await createSupabaseServerClient();
      await persistImportToSupabase(sb, session.company.id, session.user.id, dataset, clean, report);
    } catch (e) {
      console.error("import failed", e);
      return { ok: false, error: "We couldn't save your data. Please try again." };
    }
  }

  return {
    ok: true,
    summary: {
      products: dataset.products.length,
      warehouses: dataset.warehouses.length,
      suppliers: dataset.suppliers.length,
      salesWeeks: dataset.salesWeeks.filter((s) => s.qty > 0).length,
      purchaseOrders: dataset.purchaseOrders.length,
      enquiries: dataset.enquiries.length,
      validRows: report.validRows,
      errorRows: report.errorRows,
    },
  };
}

export async function chooseSampleDataAction(): Promise<{ ok: boolean }> {
  const session = await authed();
  if (session.mode === "demo") {
    const p = await readDemoSessionPayload();
    if (p) await writeDemoSession({ ...p, dataSource: "sample", onboarded: true });
  } else {
    const sb = await createSupabaseServerClient();
    await sb.from("companies").update({ data_source: "sample", onboarding_completed: true }).eq("id", session.company.id);
  }
  return { ok: true };
}

export async function createCompanyAction(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.mode !== "supabase") return { error: "Not available." };
  const name = z.string().trim().min(2).max(120).safeParse(formData.get("companyName"));
  if (!name.success) return { error: "Enter your company name." };
  const sb = await createSupabaseServerClient();
  const { error } = await sb.rpc("create_company_for_current_user", { company_name: name.data });
  if (error) return { error: "Could not create company." };
  redirect("/onboarding");
}
