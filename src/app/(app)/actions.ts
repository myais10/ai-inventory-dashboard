"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, readDemoSessionPayload, writeDemoSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getWorkspace } from "@/lib/data";
import { tenant } from "@/lib/data/demo-store";
import { answerQuestion, type AssistantAnswer } from "@/lib/ai/assistant";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RecommendationStatus } from "@/lib/types";

async function authed() {
  const session = await getSession();
  if (!session?.company) throw new Error("Unauthorized");
  return session as typeof session & { company: NonNullable<typeof session.company> };
}

export async function askAssistantAction(question: string): Promise<AssistantAnswer> {
  const session = await authed();
  const q = z.string().trim().min(1).max(300).safeParse(question);
  if (!q.success) return { answer: "Please ask a question about your inventory (max 300 characters).", bullets: [], links: [] };
  const ws = await getWorkspace(session);
  return answerQuestion(ws, q.data);
}

const statusSchema = z.object({
  id: z.string().regex(/^rec-[a-z0-9.\-/]+$/i).max(120),
  status: z.enum(["new", "in_review", "approved", "dismissed", "completed"]),
});

export async function updateRecommendationStatusAction(id: string, status: RecommendationStatus): Promise<{ ok: boolean; error?: string }> {
  const session = await authed();
  if (!can(session.role, "recommendations:update")) return { ok: false, error: "Your role doesn't allow changing recommendations." };
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  if (session.mode === "demo") {
    tenant(session.company.id).recommendationStatus.set(parsed.data.id, parsed.data.status);
  } else {
    const ws = await getWorkspace(session);
    const rec = ws.recommendations.find((r) => r.id === parsed.data.id);
    if (!rec) return { ok: false, error: "Recommendation not found" };
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("recommendations").upsert(
      {
        company_id: session.company.id,
        external_key: rec.id,
        type: rec.type,
        priority: rec.priority,
        status: parsed.data.status,
        title: rec.title,
        issue: rec.issue,
        recommendation: rec.recommendation,
        impact_value: rec.impactValue,
        suggested_qty: rec.suggestedQty ?? null,
        payload: { facts: rec.facts, reasoning: rec.reasoning },
        acted_by: session.user.id,
        acted_at: new Date().toISOString(),
      },
      { onConflict: "company_id,external_key" },
    );
    if (error) return { ok: false, error: "Could not save. Try again." };
    await sb.from("audit_logs").insert({ company_id: session.company.id, actor_id: session.user.id, action: `recommendation.${parsed.data.status}`, entity_type: "recommendation", entity_id: rec.id });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(80).optional().default(""),
  currency: z.enum(["USD", "CAD", "EUR", "GBP", "AUD"]).default("USD"),
  timezone: z.string().max(60).optional(),
});

export async function updateCompanyAction(_: unknown, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const session = await authed();
  if (!can(session.role, "company:update")) return { error: "Only owners and admins can edit company settings." };
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (session.mode === "demo") {
    const p = await readDemoSessionPayload();
    if (p) await writeDemoSession({ ...p, companyName: parsed.data.name, industry: parsed.data.industry });
    tenant(session.company.id).companyDetails = { ...tenant(session.company.id).companyDetails, industry: parsed.data.industry, currency: parsed.data.currency };
  } else {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("companies").update({ name: parsed.data.name, industry: parsed.data.industry, currency: parsed.data.currency, timezone: parsed.data.timezone }).eq("id", session.company.id);
    if (error) return { error: "Could not save company settings." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["admin", "manager", "viewer"]) });

export async function inviteUserAction(_: unknown, formData: FormData): Promise<{ ok?: boolean; error?: string; email?: string; role?: string }> {
  const session = await authed();
  if (!can(session.role, "users:manage")) return { error: "Only owners and admins can invite users." };
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and role." };
  if (session.mode === "supabase") {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("memberships").insert({ company_id: session.company.id, invited_email: parsed.data.email, role: parsed.data.role, status: "invited" });
    if (error) return { error: "Could not create invitation." };
  }
  return { ok: true, email: parsed.data.email, role: parsed.data.role };
}

const profileSchema = z.object({ fullName: z.string().trim().min(2).max(80), jobTitle: z.string().trim().max(80).optional() });

export async function updateProfileAction(_: unknown, formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const session = await authed();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your full name." };
  if (session.mode === "demo") {
    const p = await readDemoSessionPayload();
    if (p) await writeDemoSession({ ...p, fullName: parsed.data.fullName });
  } else {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.from("profiles").update({ full_name: parsed.data.fullName, job_title: parsed.data.jobTitle }).eq("id", session.user.id);
    if (error) return { error: "Could not save profile." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
