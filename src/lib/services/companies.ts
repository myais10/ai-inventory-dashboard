import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, max, or, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import type { Ctx } from "./context";

export async function listCompanies(ctx: Ctx, opts: { q?: string; industry?: string; page?: number }) {
  const db = await getDb();
  const page = Math.max(1, opts.page ?? 1);
  const like = opts.q?.trim() ? `%${opts.q.trim().replace(/[%_]/g, (m) => `\\${m}`)}%` : null;
  const where = and(
    eq(s.companies.orgId, ctx.orgId),
    like ? or(ilike(s.companies.name, like), ilike(s.companies.city, like), ilike(s.companies.domain, like)) : undefined,
    opts.industry ? eq(s.companies.industry, opts.industry) : undefined,
  );
  const openDeals = db
    .select({ companyId: s.deals.companyId, value: sql<number>`sum(${s.deals.value})`.as("open_value"), n: count().as("open_deals") })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.pipelineStages.kind, "open")))
    .groupBy(s.deals.companyId)
    .as("od");
  const leadAgg = db
    .select({
      companyId: s.leads.companyId,
      leads: count().as("lead_count"),
      best: max(s.leads.score).as("best_score"),
      lastTouch: max(s.leads.lastContactedAt).as("last_touch"),
      qualified: sql<number>`count(*) filter (where ${s.leads.status} in ('qualified','converted'))`.as("qualified"),
    })
    .from(s.leads)
    .where(eq(s.leads.orgId, ctx.orgId))
    .groupBy(s.leads.companyId)
    .as("la");
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        company: s.companies,
        leads: leadAgg.leads,
        best: leadAgg.best,
        lastTouch: leadAgg.lastTouch,
        qualified: leadAgg.qualified,
        openValue: openDeals.value,
        openDeals: openDeals.n,
      })
      .from(s.companies)
      .leftJoin(leadAgg, eq(leadAgg.companyId, s.companies.id))
      .leftJoin(openDeals, eq(openDeals.companyId, s.companies.id))
      .where(where)
      .orderBy(sql`${openDeals.value} desc nulls last`, sql`${leadAgg.best} desc nulls last`, asc(s.companies.name))
      .limit(50)
      .offset((page - 1) * 50),
    db.select({ total: count() }).from(s.companies).where(where),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / 50)) };
}

export async function companyIndustries(ctx: Ctx) {
  const db = await getDb();
  const rows = await db.selectDistinct({ industry: s.companies.industry }).from(s.companies).where(eq(s.companies.orgId, ctx.orgId)).orderBy(asc(s.companies.industry));
  return rows.map((r) => r.industry).filter(Boolean) as string[];
}

export async function getCompany(ctx: Ctx, id: string) {
  const db = await getDb();
  const [company] = await db.select().from(s.companies).where(and(eq(s.companies.orgId, ctx.orgId), eq(s.companies.id, id)));
  if (!company) return null;
  const [people, deals] = await Promise.all([
    db
      .select({ lead: s.leads, contact: s.contacts, owner: s.users.name })
      .from(s.contacts)
      .innerJoin(s.leads, eq(s.leads.contactId, s.contacts.id))
      .leftJoin(s.users, eq(s.users.id, s.leads.ownerId))
      .where(and(eq(s.contacts.orgId, ctx.orgId), eq(s.contacts.companyId, id)))
      .orderBy(desc(s.leads.score)),
    db
      .select({ deal: s.deals, stage: s.pipelineStages, owner: s.users.name })
      .from(s.deals)
      .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
      .leftJoin(s.users, eq(s.users.id, s.deals.ownerId))
      .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.deals.companyId, id)))
      .orderBy(desc(s.deals.createdAt)),
  ]);
  const leadIds = people.map((p) => p.lead.id);
  const timeline = leadIds.length
    ? await db
        .select({ a: s.activities, userName: s.users.name, recordingUrl: s.calls.recordingUrl, first: s.contacts.firstName, last: s.contacts.lastName })
        .from(s.activities)
        .leftJoin(s.users, eq(s.users.id, s.activities.userId))
        .leftJoin(s.calls, eq(s.calls.id, s.activities.callId))
        .leftJoin(s.leads, eq(s.leads.id, s.activities.leadId))
        .leftJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
        .where(and(eq(s.activities.orgId, ctx.orgId), inArray(s.activities.leadId, leadIds)))
        .orderBy(desc(s.activities.occurredAt))
        .limit(80)
    : [];
  return { company, people, deals, timeline };
}
