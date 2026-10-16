import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { UserError } from "./errors";
import { getDb, schema as s } from "@/lib/db";
import type { LeadStatus } from "@/lib/domain/dispositions";
import { LEAD_STATUS_MAP } from "@/lib/domain/dispositions";
import { rescore } from "@/lib/domain/outcome";
import { rankLead } from "@/lib/domain/queue";
import { addBusinessDays } from "@/lib/domain/time";
import { canWorkLead, type Ctx } from "./context";

export const PAGE_SIZE = 50;

export interface LeadFilters {
  q?: string;
  status?: LeadStatus[];
  owner?: string; // "me" | "unassigned" | userId | "all"
  campaign?: string;
  source?: string;
  minScore?: number;
  view?: "due" | "callbacks" | "hot" | "untouched";
  sort?: "score" | "last_contacted" | "next_action" | "created" | "name" | "company";
  page?: number;
}

export function leadWhere(ctx: Ctx, f: LeadFilters): SQL {
  const w: (SQL | undefined)[] = [eq(s.leads.orgId, ctx.orgId)];
  if (f.q?.trim()) {
    const terms = f.q.trim().split(/\s+/).slice(0, 5);
    for (const t of terms) {
      const like = `%${t.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      const digits = t.replace(/\D/g, "");
      w.push(
        or(
          ilike(s.contacts.firstName, like),
          ilike(s.contacts.lastName, like),
          ilike(s.contacts.email, like),
          ilike(s.contacts.title, like),
          ilike(s.companies.name, like),
          ilike(s.companies.industry, like),
          ilike(s.companies.city, like),
          digits.length >= 4 ? or(ilike(s.contacts.phone, `%${digits}%`), ilike(s.contacts.mobile, `%${digits}%`)) : undefined,
        ),
      );
    }
  }
  if (f.status?.length) w.push(inArray(s.leads.status, f.status));
  if (f.owner === "me") w.push(eq(s.leads.ownerId, ctx.userId));
  else if (f.owner === "unassigned") w.push(isNull(s.leads.ownerId));
  else if (f.owner && f.owner !== "all") w.push(eq(s.leads.ownerId, f.owner));
  if (f.campaign) w.push(eq(s.leads.campaignId, f.campaign));
  if (f.source) w.push(eq(s.leads.source, f.source));
  if (f.minScore) w.push(gte(s.leads.score, f.minScore));
  if (f.view === "due" || f.view === "callbacks") {
    w.push(ne(s.leads.nextActionType, "none"), or(isNull(s.leads.nextActionAt), lte(s.leads.nextActionAt, new Date())));
    w.push(notInArray(s.leads.status, ["unqualified", "converted"]), eq(s.contacts.doNotCall, false), eq(s.contacts.phoneInvalid, false));
    if (f.view === "callbacks") w.push(eq(s.leads.nextActionType, "callback"));
  }
  if (f.view === "hot") w.push(gte(s.leads.score, 60), notInArray(s.leads.status, ["unqualified", "converted"]));
  if (f.view === "untouched") w.push(eq(s.leads.attemptCount, 0));
  return and(...w)!;
}

const listColumns = {
  id: s.leads.id,
  status: s.leads.status,
  score: s.leads.score,
  source: s.leads.source,
  attemptCount: s.leads.attemptCount,
  lastContactedAt: s.leads.lastContactedAt,
  lastDisposition: s.leads.lastDisposition,
  nextActionAt: s.leads.nextActionAt,
  nextActionType: s.leads.nextActionType,
  createdAt: s.leads.createdAt,
  ownerId: s.leads.ownerId,
  ownerName: s.users.name,
  contactId: s.contacts.id,
  firstName: s.contacts.firstName,
  lastName: s.contacts.lastName,
  title: s.contacts.title,
  phone: s.contacts.phone,
  mobile: s.contacts.mobile,
  timezone: s.contacts.timezone,
  doNotCall: s.contacts.doNotCall,
  phoneInvalid: s.contacts.phoneInvalid,
  companyId: s.companies.id,
  companyName: s.companies.name,
  industry: s.companies.industry,
  employeeCount: s.companies.employeeCount,
  city: s.companies.city,
  state: s.companies.state,
  campaignName: s.campaigns.name,
};

export async function listLeads(ctx: Ctx, f: LeadFilters) {
  const db = await getDb();
  const where = leadWhere(ctx, f);
  const order = {
    score: [desc(s.leads.score), asc(s.leads.id)],
    last_contacted: [sql`${s.leads.lastContactedAt} desc nulls last`, asc(s.leads.id)],
    next_action: [sql`${s.leads.nextActionAt} asc nulls first`, desc(s.leads.score)],
    created: [desc(s.leads.createdAt), asc(s.leads.id)],
    name: [asc(s.contacts.lastName), asc(s.contacts.firstName)],
    company: [asc(s.companies.name), asc(s.contacts.lastName)],
  }[f.sort ?? "score"];
  const page = Math.max(1, f.page ?? 1);
  const base = () =>
    db
      .select(listColumns)
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
      .leftJoin(s.users, eq(s.users.id, s.leads.ownerId))
      .leftJoin(s.campaigns, eq(s.campaigns.id, s.leads.campaignId));
  const [rows, [{ total }]] = await Promise.all([
    base()
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
      .where(where),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type LeadListRow = Awaited<ReturnType<typeof listLeads>>["rows"][number];

export async function leadCounts(ctx: Ctx) {
  const db = await getDb();
  const rows = await db
    .select({ status: s.leads.status, n: count() })
    .from(s.leads)
    .where(eq(s.leads.orgId, ctx.orgId))
    .groupBy(s.leads.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<LeadStatus, number>>;
}

export async function getLead(ctx: Ctx, id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ lead: s.leads, contact: s.contacts, company: s.companies, owner: { id: s.users.id, name: s.users.name }, campaign: s.campaigns })
    .from(s.leads)
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
    .leftJoin(s.users, eq(s.users.id, s.leads.ownerId))
    .leftJoin(s.campaigns, eq(s.campaigns.id, s.leads.campaignId))
    .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, id)))
    .limit(1);
  if (!row) return null;

  const [timeline, openTasks, deals, meetings, colleagues] = await Promise.all([
    leadTimeline(ctx, id),
    db
      .select({ task: s.tasks, assignee: s.users.name })
      .from(s.tasks)
      .leftJoin(s.users, eq(s.users.id, s.tasks.assigneeId))
      .where(and(eq(s.tasks.orgId, ctx.orgId), eq(s.tasks.leadId, id), isNull(s.tasks.completedAt)))
      .orderBy(asc(s.tasks.dueAt)),
    db
      .select({ deal: s.deals, stage: s.pipelineStages })
      .from(s.deals)
      .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
      .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.deals.leadId, id)))
      .orderBy(desc(s.deals.createdAt)),
    db
      .select()
      .from(s.meetings)
      .where(and(eq(s.meetings.orgId, ctx.orgId), eq(s.meetings.leadId, id)))
      .orderBy(desc(s.meetings.scheduledAt)),
    row.company
      ? db
          .select({ leadId: s.leads.id, firstName: s.contacts.firstName, lastName: s.contacts.lastName, title: s.contacts.title, status: s.leads.status })
          .from(s.contacts)
          .innerJoin(s.leads, eq(s.leads.contactId, s.contacts.id))
          .where(and(eq(s.contacts.orgId, ctx.orgId), eq(s.contacts.companyId, row.company.id), ne(s.leads.id, id)))
      : Promise.resolve([]),
  ]);
  const now = new Date();
  const ranked = rankLead({ ...row.lead, timezone: row.contact.timezone }, now);
  return { ...row, timeline, openTasks, deals, meetings, colleagues, ranked, canWork: canWorkLead(ctx, row.lead.ownerId) };
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLead>>>;

export async function leadTimeline(ctx: Ctx, leadId: string, limit = 100) {
  const db = await getDb();
  return db
    .select({ a: s.activities, userName: s.users.name, recordingUrl: s.calls.recordingUrl })
    .from(s.activities)
    .leftJoin(s.users, eq(s.users.id, s.activities.userId))
    .leftJoin(s.calls, eq(s.calls.id, s.activities.callId))
    .where(and(eq(s.activities.orgId, ctx.orgId), eq(s.activities.leadId, leadId)))
    .orderBy(desc(s.activities.occurredAt))
    .limit(limit);
}

export type TimelineItem = Awaited<ReturnType<typeof leadTimeline>>[number];

// ---------- Mutations ----------

export async function assignLeads(ctx: Ctx, leadIds: string[], ownerId: string | null) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    let ownerName = "Unassigned";
    if (ownerId) {
      const [m] = await tx
        .select({ name: s.users.name })
        .from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
        .where(and(eq(s.memberships.orgId, ctx.orgId), eq(s.memberships.userId, ownerId)));
      if (!m) throw new UserError("That user is not in this workspace");
      ownerName = m.name;
    }
    const updated = await tx
      .update(s.leads)
      .set({ ownerId, updatedAt: new Date() })
      .where(and(eq(s.leads.orgId, ctx.orgId), inArray(s.leads.id, leadIds)))
      .returning({ id: s.leads.id, companyId: s.leads.companyId });
    if (updated.length) {
      await tx.insert(s.activities).values(
        updated.map((l) => ({
          orgId: ctx.orgId,
          leadId: l.id,
          companyId: l.companyId,
          userId: ctx.userId,
          type: "assignment",
          title: ownerId ? `Assigned to ${ownerName}` : "Unassigned",
          meta: { ownerId },
        })),
      );
      // Open auto tasks follow the lead to its new owner.
      await tx
        .update(s.tasks)
        .set({ assigneeId: ownerId })
        .where(and(eq(s.tasks.orgId, ctx.orgId), inArray(s.tasks.leadId, updated.map((u) => u.id)), isNull(s.tasks.completedAt), eq(s.tasks.auto, true)));
    }
    return updated.length;
  });
}

/** Manual status change from Lead Detail. Keeps the next action coherent with the new status. */
export async function setLeadStatus(ctx: Ctx, leadId: string, status: LeadStatus, reason?: string | null) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [cur] = await tx
      .select({ lead: s.leads, contact: s.contacts, company: s.companies, org: s.organizations })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
      .innerJoin(s.organizations, eq(s.organizations.id, s.leads.orgId))
      .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, leadId)));
    if (!cur) throw new UserError("Lead not found");
    if (!canWorkLead(ctx, cur.lead.ownerId)) throw new UserError("This lead belongs to another rep");
    if (cur.lead.status === status) return;
    const now = new Date();
    const next =
      status === "unqualified" || status === "converted" || status === "qualified"
        ? { nextActionAt: null, nextActionType: "none", nextActionReason: status === "qualified" ? "Qualified — manage next steps on the deal" : null }
        : status === "nurture"
          ? { nextActionAt: addBusinessDays(now, 20, cur.contact.timezone), nextActionType: "call", nextActionReason: "Nurture — check back in ~4 weeks" }
          : { nextActionAt: now, nextActionType: "call", nextActionReason: `Set to ${LEAD_STATUS_MAP[status].label} — call when ready` };
    const patched = { ...cur.lead, status, unqualifiedReason: status === "unqualified" ? reason || "Disqualified manually" : null };
    const { score, factors } = rescore(patched, cur.contact, cur.company, icpOf(cur.org), now);
    await tx
      .update(s.leads)
      .set({ status, unqualifiedReason: patched.unqualifiedReason, ...next, score, scoreFactors: factors, updatedAt: now })
      .where(eq(s.leads.id, leadId));
    await tx.insert(s.activities).values({
      orgId: ctx.orgId,
      leadId,
      companyId: cur.lead.companyId,
      userId: ctx.userId,
      type: "status_change",
      title: `Status changed to ${LEAD_STATUS_MAP[status].label}`,
      body: status === "unqualified" ? patched.unqualifiedReason : null,
      meta: { statusFrom: cur.lead.status, statusTo: status },
    });
    if (status === "unqualified" || status === "converted") {
      await tx.update(s.tasks).set({ completedAt: now }).where(and(eq(s.tasks.leadId, leadId), isNull(s.tasks.completedAt), eq(s.tasks.auto, true)));
    }
  });
}

export async function addNote(ctx: Ctx, leadId: string, body: string) {
  const db = await getDb();
  const [lead] = await db.select({ companyId: s.leads.companyId }).from(s.leads).where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, leadId)));
  if (!lead) throw new UserError("Lead not found");
  await db.insert(s.activities).values({ orgId: ctx.orgId, leadId, companyId: lead.companyId, userId: ctx.userId, type: "note", title: "Note", body });
}

export interface ContactPatch {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  timezone?: string;
}

/** Edits contact details. Fixing a phone number on a parked lead clears the invalid flag and re-queues it. */
export async function updateContactForLead(ctx: Ctx, leadId: string, patch: ContactPatch) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [cur] = await tx
      .select({ lead: s.leads, contact: s.contacts })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, leadId)));
    if (!cur) throw new UserError("Lead not found");
    if (!canWorkLead(ctx, cur.lead.ownerId)) throw new UserError("This lead belongs to another rep");
    const phoneChanged = (patch.phone !== undefined && patch.phone !== cur.contact.phone) || (patch.mobile !== undefined && patch.mobile !== cur.contact.mobile);
    const fixesPhone = phoneChanged && cur.contact.phoneInvalid;
    await tx
      .update(s.contacts)
      .set({ ...patch, ...(fixesPhone ? { phoneInvalid: false } : {}) })
      .where(eq(s.contacts.id, cur.contact.id));
    const changed = Object.keys(patch).filter((k) => patch[k as keyof ContactPatch] !== cur.contact[k as keyof typeof cur.contact]);
    if (changed.length) {
      await tx.insert(s.activities).values({
        orgId: ctx.orgId,
        leadId,
        companyId: cur.lead.companyId,
        userId: ctx.userId,
        type: "contact_updated",
        title: fixesPhone ? "Phone number corrected — lead re-queued" : "Contact details updated",
        meta: { fields: changed },
      });
    }
    if (fixesPhone && cur.lead.nextActionType === "none" && !["unqualified", "converted", "qualified"].includes(cur.lead.status)) {
      await tx
        .update(s.leads)
        .set({ nextActionAt: new Date(), nextActionType: "call", nextActionReason: "Phone number corrected — try the new number", updatedAt: new Date() })
        .where(eq(s.leads.id, leadId));
    }
  });
}

export function icpOf(org: { icpIndustries: string[]; icpMinEmployees: number; icpMaxEmployees: number }) {
  return { industries: org.icpIndustries, minEmployees: org.icpMinEmployees, maxEmployees: org.icpMaxEmployees };
}

export async function searchEverything(ctx: Ctx, q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const db = await getDb();
  const like = `%${term.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const [leadRows, companyRows] = await Promise.all([
    db
      .select({ id: s.leads.id, first: s.contacts.firstName, last: s.contacts.lastName, title: s.contacts.title, company: s.companies.name, status: s.leads.status })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
      .where(
        and(
          eq(s.leads.orgId, ctx.orgId),
          or(
            ilike(sql`${s.contacts.firstName} || ' ' || ${s.contacts.lastName}`, like),
            ilike(s.contacts.email, like),
            ilike(s.companies.name, like),
            term.replace(/\D/g, "").length >= 4 ? ilike(s.contacts.phone, `%${term.replace(/\D/g, "")}%`) : undefined,
          ),
        ),
      )
      .orderBy(desc(s.leads.score))
      .limit(8),
    db
      .select({ id: s.companies.id, name: s.companies.name, industry: s.companies.industry, city: s.companies.city })
      .from(s.companies)
      .where(and(eq(s.companies.orgId, ctx.orgId), ilike(s.companies.name, like)))
      .limit(5),
  ]);
  return [
    ...leadRows.map((l) => ({ type: "Lead" as const, label: `${l.first} ${l.last}`, sub: [l.title, l.company, LEAD_STATUS_MAP[l.status].label].filter(Boolean).join(" · "), href: `/leads/${l.id}` })),
    ...companyRows.map((c) => ({ type: "Company" as const, label: c.name, sub: [c.industry, c.city].filter(Boolean).join(" · "), href: `/companies/${c.id}` })),
  ];
}
