import "server-only";
import { and, asc, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { estimateDealValue } from "@/lib/domain/outcome";
import { addBusinessDays } from "@/lib/domain/time";
import { canWorkLead, isManagerRole, type Ctx } from "./context";
import { UserError } from "./errors";

export async function listStages(ctx: Ctx) {
  const db = await getDb();
  return db.select().from(s.pipelineStages).where(eq(s.pipelineStages.orgId, ctx.orgId)).orderBy(asc(s.pipelineStages.position));
}

export type Stage = Awaited<ReturnType<typeof listStages>>[number];

export async function pipelineBoard(ctx: Ctx, opts: { owner: string }) {
  const db = await getDb();
  const stages = await listStages(ctx);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const nextMeeting = db
    .select({ dealId: s.meetings.dealId, at: sql<Date>`min(${s.meetings.scheduledAt})`.as("next_meeting_at") })
    .from(s.meetings)
    .where(and(eq(s.meetings.orgId, ctx.orgId), eq(s.meetings.status, "scheduled"), gte(s.meetings.scheduledAt, new Date())))
    .groupBy(s.meetings.dealId)
    .as("nm");
  const openTasks = db
    .select({
      dealId: s.tasks.dealId,
      n: sql<number>`count(*)::int`.as("open_tasks"),
      overdue: sql<number>`count(*) filter (where ${s.tasks.dueAt} < now())::int`.as("overdue_tasks"),
    })
    .from(s.tasks)
    .where(and(eq(s.tasks.orgId, ctx.orgId), isNull(s.tasks.completedAt)))
    .groupBy(s.tasks.dealId)
    .as("ot");
  const lastActivity = db
    .select({ dealId: s.activities.dealId, at: sql<Date>`max(${s.activities.occurredAt})`.as("last_activity_at") })
    .from(s.activities)
    .where(eq(s.activities.orgId, ctx.orgId))
    .groupBy(s.activities.dealId)
    .as("la");
  const rows = await db
    .select({
      deal: s.deals,
      lastActivityAt: lastActivity.at,
      companyName: s.companies.name,
      contactFirst: s.contacts.firstName,
      contactLast: s.contacts.lastName,
      ownerName: s.users.name,
      nextMeetingAt: nextMeeting.at,
      openTasks: openTasks.n,
      overdueTasks: openTasks.overdue,
    })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .leftJoin(s.companies, eq(s.companies.id, s.deals.companyId))
    .leftJoin(s.contacts, eq(s.contacts.id, s.deals.contactId))
    .leftJoin(s.users, eq(s.users.id, s.deals.ownerId))
    .leftJoin(nextMeeting, eq(nextMeeting.dealId, s.deals.id))
    .leftJoin(openTasks, eq(openTasks.dealId, s.deals.id))
    .leftJoin(lastActivity, eq(lastActivity.dealId, s.deals.id))
    .where(
      and(
        eq(s.deals.orgId, ctx.orgId),
        opts.owner === "all" ? undefined : eq(s.deals.ownerId, opts.owner === "me" ? ctx.userId : opts.owner),
        or(eq(s.pipelineStages.kind, "open"), gte(s.deals.closedAt, since)),
      ),
    )
    .orderBy(desc(s.deals.value));
  return { stages, deals: rows };
}

export type BoardDeal = Awaited<ReturnType<typeof pipelineBoard>>["deals"][number];

export async function pipelineSummary(ctx: Ctx, owner: string) {
  const db = await getDb();
  const ownerCond = owner === "all" ? undefined : eq(s.deals.ownerId, owner === "me" ? ctx.userId : owner);
  const [r] = await db
    .select({
      openValue: sql<number>`coalesce(sum(${s.deals.value}) filter (where ${s.pipelineStages.kind} = 'open'), 0)::int`,
      weighted: sql<number>`coalesce(sum(${s.deals.value} * ${s.pipelineStages.probability} / 100.0) filter (where ${s.pipelineStages.kind} = 'open'), 0)::int`,
      openCount: sql<number>`count(*) filter (where ${s.pipelineStages.kind} = 'open')::int`,
      wonValue90: sql<number>`coalesce(sum(${s.deals.value}) filter (where ${s.pipelineStages.kind} = 'won' and ${s.deals.closedAt} > now() - interval '90 days'), 0)::int`,
      won90: sql<number>`count(*) filter (where ${s.pipelineStages.kind} = 'won' and ${s.deals.closedAt} > now() - interval '90 days')::int`,
      lost90: sql<number>`count(*) filter (where ${s.pipelineStages.kind} = 'lost' and ${s.deals.closedAt} > now() - interval '90 days')::int`,
      stale: sql<number>`count(*) filter (where ${s.pipelineStages.kind} = 'open' and ${s.deals.stageChangedAt} < now() - interval '14 days')::int`,
    })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .where(and(eq(s.deals.orgId, ctx.orgId), ownerCond));
  return r;
}

async function loadDeal(ctx: Ctx, dealId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ deal: s.deals, stage: s.pipelineStages, lead: s.leads })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .leftJoin(s.leads, eq(s.leads.id, s.deals.leadId))
    .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.deals.id, dealId)));
  if (!row) throw new UserError("Deal not found");
  if (!isManagerRole(ctx.role) && row.deal.ownerId !== ctx.userId) throw new UserError("Only the deal owner or a manager can change this deal");
  return row;
}

export async function getDeal(ctx: Ctx, dealId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ deal: s.deals, stage: s.pipelineStages, company: s.companies, contact: s.contacts, lead: s.leads, owner: { id: s.users.id, name: s.users.name } })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .leftJoin(s.companies, eq(s.companies.id, s.deals.companyId))
    .leftJoin(s.contacts, eq(s.contacts.id, s.deals.contactId))
    .leftJoin(s.leads, eq(s.leads.id, s.deals.leadId))
    .leftJoin(s.users, eq(s.users.id, s.deals.ownerId))
    .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.deals.id, dealId)));
  if (!row) return null;
  const [stages, timeline, tasks, meetings] = await Promise.all([
    listStages(ctx),
    db
      .select({ a: s.activities, userName: s.users.name, recordingUrl: s.calls.recordingUrl })
      .from(s.activities)
      .leftJoin(s.users, eq(s.users.id, s.activities.userId))
      .leftJoin(s.calls, eq(s.calls.id, s.activities.callId))
      .where(and(eq(s.activities.orgId, ctx.orgId), row.deal.leadId ? or(eq(s.activities.dealId, dealId), eq(s.activities.leadId, row.deal.leadId)) : eq(s.activities.dealId, dealId)))
      .orderBy(desc(s.activities.occurredAt))
      .limit(100),
    db
      .select({ task: s.tasks, assignee: s.users.name })
      .from(s.tasks)
      .leftJoin(s.users, eq(s.users.id, s.tasks.assigneeId))
      .where(and(eq(s.tasks.orgId, ctx.orgId), isNull(s.tasks.completedAt), row.deal.leadId ? or(eq(s.tasks.dealId, dealId), eq(s.tasks.leadId, row.deal.leadId)) : eq(s.tasks.dealId, dealId)))
      .orderBy(asc(s.tasks.dueAt)),
    db
      .select()
      .from(s.meetings)
      .where(and(eq(s.meetings.orgId, ctx.orgId), row.deal.leadId ? or(eq(s.meetings.dealId, dealId), eq(s.meetings.leadId, row.deal.leadId)) : eq(s.meetings.dealId, dealId)))
      .orderBy(desc(s.meetings.scheduledAt)),
  ]);
  const canEdit = isManagerRole(ctx.role) || row.deal.ownerId === ctx.userId;
  return { ...row, stages, timeline, tasks, meetings, canEdit };
}

/** Moves a deal between stages and keeps the lead in sync (won → converted; reopened → qualified). */
export async function moveDealStage(ctx: Ctx, dealId: string, stageId: string, lostReason?: string | null) {
  const db = await getDb();
  const cur = await loadDeal(ctx, dealId);
  if (cur.deal.stageId === stageId) return;
  const [to] = await db.select().from(s.pipelineStages).where(and(eq(s.pipelineStages.orgId, ctx.orgId), eq(s.pipelineStages.id, stageId)));
  if (!to) throw new UserError("Unknown stage");
  if (to.kind === "lost" && !lostReason) throw new UserError("Pick a lost reason");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(s.deals)
      .set({
        stageId,
        stageChangedAt: now,
        updatedAt: now,
        closedAt: to.kind === "open" ? null : now,
        lostReason: to.kind === "lost" ? lostReason : null,
      })
      .where(eq(s.deals.id, dealId));
    await tx.insert(s.activities).values({
      orgId: ctx.orgId,
      leadId: cur.deal.leadId,
      companyId: cur.deal.companyId,
      dealId,
      userId: ctx.userId,
      type: "stage_change",
      title: `Deal moved to ${to.name}`,
      body: to.kind === "lost" ? `Lost reason: ${lostReason}` : null,
      meta: { stageFrom: cur.stage.name, stageTo: to.name, value: cur.deal.value },
    });
    if (to.kind !== "open") {
      await tx.update(s.tasks).set({ completedAt: now }).where(and(eq(s.tasks.dealId, dealId), isNull(s.tasks.completedAt)));
    }
    if (cur.lead) {
      const nextStatus = to.kind === "won" ? "converted" : to.kind === "open" && cur.lead.status === "converted" ? "qualified" : null;
      if (nextStatus && nextStatus !== cur.lead.status) {
        await tx.update(s.leads).set({ status: nextStatus, nextActionType: "none", nextActionAt: null, updatedAt: now }).where(eq(s.leads.id, cur.lead.id));
        await tx.insert(s.activities).values({
          orgId: ctx.orgId,
          leadId: cur.lead.id,
          companyId: cur.deal.companyId,
          userId: ctx.userId,
          type: "status_change",
          title: nextStatus === "converted" ? "Lead converted to customer" : "Lead reopened as qualified",
          meta: { statusFrom: cur.lead.status, statusTo: nextStatus },
        });
      }
    }
  });
  return to;
}

export async function updateDeal(ctx: Ctx, dealId: string, patch: { name?: string; value?: number; expectedCloseDate?: string | null; nextStep?: string | null }) {
  const db = await getDb();
  const cur = await loadDeal(ctx, dealId);
  await db.transaction(async (tx) => {
    await tx.update(s.deals).set({ ...patch, updatedAt: new Date() }).where(eq(s.deals.id, dealId));
    if (patch.value !== undefined && patch.value !== cur.deal.value) {
      await tx.insert(s.activities).values({
        orgId: ctx.orgId,
        leadId: cur.deal.leadId,
        companyId: cur.deal.companyId,
        dealId,
        userId: ctx.userId,
        type: "deal_updated",
        title: `Deal value changed to $${patch.value.toLocaleString()}`,
        meta: { valueFrom: cur.deal.value, valueTo: patch.value },
      });
    }
  });
}

/** Opens a deal for a lead that qualified without a meeting being booked through the desk. */
export async function createDealFromLead(ctx: Ctx, leadId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ lead: s.leads, company: s.companies, contact: s.contacts })
    .from(s.leads)
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
    .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, leadId)));
  if (!row) throw new UserError("Lead not found");
  if (!canWorkLead(ctx, row.lead.ownerId)) throw new UserError("This lead belongs to another rep");
  const open = await db
    .select({ id: s.deals.id })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .where(and(eq(s.deals.leadId, leadId), eq(s.pipelineStages.kind, "open")));
  if (open.length) throw new UserError("This lead already has an open deal");
  const stages = await listStages(ctx);
  const first = stages.find((st) => st.kind === "open")!;
  const now = new Date();
  return db.transaction(async (tx) => {
    const [deal] = await tx
      .insert(s.deals)
      .values({
        orgId: ctx.orgId,
        leadId,
        companyId: row.lead.companyId,
        contactId: row.contact.id,
        ownerId: row.lead.ownerId ?? ctx.userId,
        stageId: first.id,
        name: `${row.company?.name ?? `${row.contact.firstName} ${row.contact.lastName}`} — New business`,
        value: estimateDealValue(row.company?.employeeCount),
        expectedCloseDate: new Date(now.getTime() + 45 * 86_400_000).toISOString().slice(0, 10),
        nextStep: "Book the discovery meeting",
      })
      .returning();
    await tx.insert(s.activities).values({ orgId: ctx.orgId, leadId, companyId: row.lead.companyId, dealId: deal.id, userId: ctx.userId, type: "deal_created", title: `Deal opened · ${deal.name}`, meta: { value: deal.value, stage: first.name } });
    if (row.lead.status !== "qualified") {
      await tx.update(s.leads).set({ status: "qualified", nextActionType: "none", nextActionAt: null, nextActionReason: "Qualified — the deal now drives next steps", updatedAt: now }).where(eq(s.leads.id, leadId));
      await tx.insert(s.activities).values({ orgId: ctx.orgId, leadId, companyId: row.lead.companyId, userId: ctx.userId, type: "status_change", title: "Status changed to Qualified", meta: { statusFrom: row.lead.status, statusTo: "qualified" } });
    }
    return deal;
  });
}

/** Records how a scheduled meeting went. Held discovery meetings advance the deal; no-shows create a reschedule task. */
export async function setMeetingOutcome(ctx: Ctx, meetingId: string, outcome: "held" | "no_show" | "cancelled") {
  const db = await getDb();
  const [m] = await db.select().from(s.meetings).where(and(eq(s.meetings.orgId, ctx.orgId), eq(s.meetings.id, meetingId)));
  if (!m) throw new UserError("Meeting not found");
  if (!isManagerRole(ctx.role) && m.userId !== ctx.userId) throw new UserError("Only the meeting owner or a manager can update this meeting");
  if (m.status !== "scheduled") throw new UserError("This meeting already has an outcome");
  const [lead] = m.leadId ? await db.select().from(s.leads).where(eq(s.leads.id, m.leadId)) : [];
  const [contact] = lead ? await db.select().from(s.contacts).where(eq(s.contacts.id, lead.contactId)) : [];
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(s.meetings).set({ status: outcome }).where(eq(s.meetings.id, meetingId));
    await tx.insert(s.activities).values({
      orgId: ctx.orgId,
      leadId: m.leadId,
      dealId: m.dealId,
      companyId: lead?.companyId ?? null,
      userId: ctx.userId,
      type: "meeting",
      title: `${outcome === "held" ? "Meeting held" : outcome === "no_show" ? "No-show" : "Meeting cancelled"} · ${m.title}`,
      meta: { meetingId },
    });
    if (m.leadId) await tx.update(s.tasks).set({ completedAt: now }).where(and(eq(s.tasks.leadId, m.leadId), eq(s.tasks.type, "meeting_prep"), isNull(s.tasks.completedAt)));
    if (outcome !== "held" && lead && contact) {
      const due = addBusinessDays(now, 1, contact.timezone);
      await tx.insert(s.tasks).values({
        orgId: ctx.orgId,
        leadId: lead.id,
        dealId: m.dealId,
        assigneeId: m.userId ?? ctx.userId,
        createdById: ctx.userId,
        type: "callback",
        title: `Reschedule meeting with ${contact.firstName} ${contact.lastName}`,
        dueAt: due,
        auto: true,
      });
      await tx.update(s.leads).set({ nextActionType: "callback", nextActionAt: due, nextActionReason: "Missed meeting — call to reschedule", updatedAt: now }).where(eq(s.leads.id, lead.id));
    }
  });
  if (outcome === "held" && m.dealId) {
    const stages = await listStages(ctx);
    const [deal] = await db.select().from(s.deals).where(eq(s.deals.id, m.dealId));
    const open = stages.filter((x) => x.kind === "open");
    if (deal && deal.stageId === open[0]?.id && open[1]) {
      await moveDealStage(ctx, deal.id, open[1].id);
      await db.update(s.deals).set({ nextStep: "Schedule product demo" }).where(eq(s.deals.id, deal.id));
    }
  }
}
