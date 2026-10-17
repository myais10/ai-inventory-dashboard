import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { CONNECTED_DISPOSITIONS } from "@/lib/domain/dispositions";
import type { Ctx } from "./context";

const connected = sql`${inArray(s.calls.disposition, CONNECTED_DISPOSITIONS)}`;

function callScope(ctx: Ctx, since: Date, until: Date, userId?: string): SQL {
  return and(
    eq(s.calls.orgId, ctx.orgId),
    gte(s.calls.startedAt, since),
    lt(s.calls.startedAt, until),
    sql`${s.calls.disposition} is not null`,
    userId ? eq(s.calls.userId, userId) : undefined,
  )!;
}

/** Headline call metrics for a period. */
export async function callKpis(ctx: Ctx, since: Date, until: Date, userId?: string) {
  const db = await getDb();
  const [r] = await db
    .select({
      dials: sql<number>`count(*)::int`,
      connects: sql<number>`count(*) filter (where ${connected})::int`,
      meetings: sql<number>`count(*) filter (where ${s.calls.disposition} = 'meeting_booked')::int`,
      talkSec: sql<number>`coalesce(sum(${s.calls.durationSec}) filter (where ${connected}), 0)::int`,
      // A conversation is a connected call that lasted at least a minute.
      conversations: sql<number>`count(*) filter (where ${connected} and ${s.calls.durationSec} >= 60)::int`,
    })
    .from(s.calls)
    .where(callScope(ctx, since, until, userId));
  const [w] = await db
    .select({ wins: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(${s.deals.value}), 0)::int` })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.pipelineStages.kind, "won"), gte(s.deals.closedAt, since), lt(s.deals.closedAt, until), userId ? eq(s.deals.ownerId, userId) : undefined));
  const [p] = await db
    .select({ created: sql<number>`coalesce(sum(${s.deals.value}), 0)::int`, n: sql<number>`count(*)::int` })
    .from(s.deals)
    .where(and(eq(s.deals.orgId, ctx.orgId), gte(s.deals.createdAt, since), lt(s.deals.createdAt, until), userId ? eq(s.deals.ownerId, userId) : undefined));
  return { ...r, ...w, pipelineCreated: p.created, dealsCreated: p.n };
}

/** Per-rep activity for the team table, plus the backlog signals a manager acts on. */
export async function repTable(ctx: Ctx, since: Date, until: Date) {
  const db = await getDb();
  const now = new Date();
  const [calls, backlog, overdue, reps, live, deals] = await Promise.all([
    db
      .select({
        userId: s.calls.userId,
        dials: sql<number>`count(*)::int`,
        connects: sql<number>`count(*) filter (where ${connected})::int`,
        meetings: sql<number>`count(*) filter (where ${s.calls.disposition} = 'meeting_booked')::int`,
        talkSec: sql<number>`coalesce(sum(${s.calls.durationSec}) filter (where ${connected}), 0)::int`,
        lastCall: sql<Date>`max(${s.calls.startedAt})`,
        conversations: sql<number>`count(*) filter (where ${connected} and ${s.calls.durationSec} >= 60)::int`,
      })
      .from(s.calls)
      .where(callScope(ctx, since, until))
      .groupBy(s.calls.userId),
    db
      .select({
        userId: s.leads.ownerId,
        due: sql<number>`count(*)::int`,
        callbacks: sql<number>`count(*) filter (where ${s.leads.nextActionType} = 'callback')::int`,
        lateCallbacks: sql<number>`count(*) filter (where ${s.leads.nextActionType} = 'callback' and ${s.leads.nextActionAt} < now() - interval '1 hour')::int`,
      })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .where(
        and(
          eq(s.leads.orgId, ctx.orgId),
          ne(s.leads.nextActionType, "none"),
          or(isNull(s.leads.nextActionAt), lte(s.leads.nextActionAt, now)),
          notInArray(s.leads.status, ["unqualified", "converted"]),
          eq(s.contacts.doNotCall, false),
          eq(s.contacts.phoneInvalid, false),
        ),
      )
      .groupBy(s.leads.ownerId),
    db
      .select({ userId: s.tasks.assigneeId, n: sql<number>`count(*)::int` })
      .from(s.tasks)
      .where(and(eq(s.tasks.orgId, ctx.orgId), isNull(s.tasks.completedAt), lt(s.tasks.dueAt, now)))
      .groupBy(s.tasks.assigneeId),
    db
      .select({ id: s.users.id, name: s.users.name, role: s.memberships.role, title: s.memberships.title })
      .from(s.memberships)
      .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
      .where(eq(s.memberships.orgId, ctx.orgId)),
    // Reps with a call in progress right now (started in the last 2h, not yet ended).
    db
      .selectDistinct({ userId: s.calls.userId })
      .from(s.calls)
      .where(and(eq(s.calls.orgId, ctx.orgId), eq(s.calls.status, "in_progress"), isNull(s.calls.endedAt), gte(s.calls.startedAt, new Date(now.getTime() - 2 * 3_600_000)))),
    db
      .select({
        userId: s.deals.ownerId,
        opps: sql<number>`count(*) filter (where ${s.deals.createdAt} >= ${since} and ${s.deals.createdAt} < ${until})::int`,
        openValue: sql<number>`coalesce(sum(${s.deals.value}) filter (where ${s.pipelineStages.kind} = 'open'), 0)::int`,
      })
      .from(s.deals)
      .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
      .where(eq(s.deals.orgId, ctx.orgId))
      .groupBy(s.deals.ownerId),
  ]);
  const onCall = new Set(live.map((l) => l.userId));
  const by = <T extends { userId: string | null }>(xs: T[]) => new Map(xs.map((x) => [x.userId, x]));
  const c = by(calls);
  const b = by(backlog);
  const o = by(overdue);
  const d = by(deals);
  return reps
    .filter((r) => r.role === "rep" || c.has(r.id) || b.has(r.id))
    .map((r) => ({
      ...r,
      dials: c.get(r.id)?.dials ?? 0,
      connects: c.get(r.id)?.connects ?? 0,
      meetings: c.get(r.id)?.meetings ?? 0,
      talkSec: c.get(r.id)?.talkSec ?? 0,
      lastCall: c.get(r.id)?.lastCall ? new Date(c.get(r.id)!.lastCall) : null,
      due: b.get(r.id)?.due ?? 0,
      callbacks: b.get(r.id)?.callbacks ?? 0,
      lateCallbacks: b.get(r.id)?.lateCallbacks ?? 0,
      overdueTasks: o.get(r.id)?.n ?? 0,
      conversations: c.get(r.id)?.conversations ?? 0,
      onCall: onCall.has(r.id),
      opps: d.get(r.id)?.opps ?? 0,
      openValue: d.get(r.id)?.openValue ?? 0,
    }))
    .sort((a, z) => z.meetings - a.meetings || z.dials - a.dials);
}

export type RepRow = Awaited<ReturnType<typeof repTable>>[number];

/** Dials / connects / meetings per calendar day in the org timezone. */
export async function dailySeries(ctx: Ctx, since: Date, until: Date, tz: string, userId?: string) {
  const db = await getDb();
  const day = sql<string>`to_char(${s.calls.startedAt} at time zone ${tz}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day,
      dials: sql<number>`count(*)::int`,
      connects: sql<number>`count(*) filter (where ${connected})::int`,
      meetings: sql<number>`count(*) filter (where ${s.calls.disposition} = 'meeting_booked')::int`,
    })
    .from(s.calls)
    .where(callScope(ctx, since, until, userId))
    // Positional: the bound timezone parameter makes repeated expressions unequal to Postgres.
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows;
}

export async function dispositionBreakdown(ctx: Ctx, since: Date, until: Date, userId?: string) {
  const db = await getDb();
  return db
    .select({ disposition: s.calls.disposition, n: sql<number>`count(*)::int` })
    .from(s.calls)
    .where(callScope(ctx, since, until, userId))
    .groupBy(s.calls.disposition)
    .orderBy(sql`count(*) desc`);
}

/** Connect rate by the contact's local hour — when are people actually picking up? */
export async function connectByLocalHour(ctx: Ctx, since: Date, until: Date, userId?: string) {
  const db = await getDb();
  const hour = sql<number>`extract(hour from ${s.calls.startedAt} at time zone ${s.contacts.timezone})::int`;
  const rows = await db
    .select({ hour, dials: sql<number>`count(*)::int`, connects: sql<number>`count(*) filter (where ${connected})::int` })
    .from(s.calls)
    .innerJoin(s.leads, eq(s.leads.id, s.calls.leadId))
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .where(callScope(ctx, since, until, userId))
    .groupBy(hour)
    .orderBy(hour);
  return rows.filter((r) => r.hour >= 8 && r.hour <= 17);
}

/** Lead-source and campaign performance for leads created in the period: where do meetings come from? */
export async function segmentPerformance(ctx: Ctx, since: Date, until: Date, by: "source" | "campaign", userId?: string) {
  const db = await getDb();
  const key = by === "source" ? s.leads.source : sql<string>`coalesce(${s.campaigns.name}, 'No campaign')`;
  const rows = await db
    .select({
      key,
      leads: sql<number>`count(distinct ${s.leads.id})::int`,
      contacted: sql<number>`count(distinct ${s.leads.id}) filter (where ${s.leads.attemptCount} > 0)::int`,
      connected: sql<number>`count(distinct ${s.leads.id}) filter (where ${s.leads.connectCount} > 0)::int`,
      meetings: sql<number>`count(distinct ${s.deals.id})::int`,
      won: sql<number>`count(distinct ${s.deals.id}) filter (where ${s.pipelineStages.kind} = 'won')::int`,
      pipeline: sql<number>`coalesce(sum(${s.deals.value}) filter (where ${s.pipelineStages.kind} <> 'lost'), 0)::int`,
    })
    .from(s.leads)
    .leftJoin(s.campaigns, eq(s.campaigns.id, s.leads.campaignId))
    .leftJoin(s.deals, eq(s.deals.leadId, s.leads.id))
    .leftJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .where(and(eq(s.leads.orgId, ctx.orgId), gte(s.leads.createdAt, since), lt(s.leads.createdAt, until), userId ? eq(s.leads.ownerId, userId) : undefined))
    .groupBy(key);
  return rows.sort((a, b) => b.meetings - a.meetings || b.leads - a.leads);
}

export async function lossReasons(ctx: Ctx, since: Date, until: Date, userId?: string) {
  const db = await getDb();
  const [deals, leads] = await Promise.all([
    db
      .select({ reason: s.deals.lostReason, n: sql<number>`count(*)::int` })
      .from(s.deals)
      .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
      .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.pipelineStages.kind, "lost"), gte(s.deals.closedAt, since), lt(s.deals.closedAt, until), userId ? eq(s.deals.ownerId, userId) : undefined))
      .groupBy(s.deals.lostReason)
      .orderBy(sql`count(*) desc`),
    db
      .select({ reason: s.leads.unqualifiedReason, n: sql<number>`count(*)::int` })
      .from(s.leads)
      .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.status, "unqualified"), gte(s.leads.updatedAt, since), lt(s.leads.updatedAt, until), userId ? eq(s.leads.ownerId, userId) : undefined))
      .groupBy(s.leads.unqualifiedReason)
      .orderBy(sql`count(*) desc`),
  ]);
  return { deals, leads };
}

/** Things a manager should act on right now. */
export async function attention(ctx: Ctx) {
  const db = await getDb();
  const [unassigned, stalled, upcomingMeetings] = await Promise.all([
    db
      .select({ id: s.leads.id, first: s.contacts.firstName, last: s.contacts.lastName, company: s.companies.name, source: s.leads.source, score: s.leads.score, createdAt: s.leads.createdAt })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
      .where(and(eq(s.leads.orgId, ctx.orgId), isNull(s.leads.ownerId), notInArray(s.leads.status, ["unqualified", "converted"])))
      .orderBy(sql`${s.leads.score} desc`)
      .limit(10),
    db
      .select({ id: s.deals.id, name: s.deals.name, company: s.companies.name, value: s.deals.value, stage: s.pipelineStages.name, since: s.deals.stageChangedAt, owner: s.users.name })
      .from(s.deals)
      .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
      .leftJoin(s.companies, eq(s.companies.id, s.deals.companyId))
      .leftJoin(s.users, eq(s.users.id, s.deals.ownerId))
      .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.pipelineStages.kind, "open"), lt(s.deals.stageChangedAt, new Date(Date.now() - 10 * 86_400_000))))
      .orderBy(sql`${s.deals.value} desc`)
      .limit(8),
    db
      .select({ id: s.meetings.id, title: s.meetings.title, at: s.meetings.scheduledAt, dealId: s.meetings.dealId, owner: s.users.name, company: s.companies.name })
      .from(s.meetings)
      .leftJoin(s.users, eq(s.users.id, s.meetings.userId))
      .leftJoin(s.leads, eq(s.leads.id, s.meetings.leadId))
      .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
      .where(and(eq(s.meetings.orgId, ctx.orgId), eq(s.meetings.status, "scheduled"), gte(s.meetings.scheduledAt, new Date()), lt(s.meetings.scheduledAt, new Date(Date.now() + 7 * 86_400_000))))
      .orderBy(s.meetings.scheduledAt)
      .limit(10),
  ]);
  return { unassigned, stalled, upcomingMeetings };
}

/** The most recent calls across the team — what is being worked right now. */
export async function recentCalls(ctx: Ctx, limit = 12) {
  const db = await getDb();
  return db
    .select({
      id: s.calls.id,
      at: s.calls.startedAt,
      status: s.calls.status,
      disposition: s.calls.disposition,
      durationSec: s.calls.durationSec,
      rep: s.users.name,
      leadId: s.leads.id,
      first: s.contacts.firstName,
      last: s.contacts.lastName,
      company: s.companies.name,
    })
    .from(s.calls)
    .innerJoin(s.leads, eq(s.leads.id, s.calls.leadId))
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
    .leftJoin(s.users, eq(s.users.id, s.calls.userId))
    .where(and(eq(s.calls.orgId, ctx.orgId), ne(s.calls.status, "abandoned")))
    .orderBy(sql`${s.calls.startedAt} desc`)
    .limit(limit);
}

/** Open pipeline value right now (not period-bound). */
export async function openPipelineValue(ctx: Ctx) {
  const db = await getDb();
  const [r] = await db
    .select({ v: sql<number>`coalesce(sum(${s.deals.value}), 0)::int`, n: sql<number>`count(*)::int` })
    .from(s.deals)
    .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
    .where(and(eq(s.deals.orgId, ctx.orgId), eq(s.pipelineStages.kind, "open")));
  return r;
}
