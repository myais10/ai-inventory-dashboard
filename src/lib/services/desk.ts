import "server-only";
import { and, eq, inArray, isNull, ne, notInArray, or } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { rankQueue, type RankedLead } from "@/lib/domain/queue";
import type { Ctx } from "./context";

const INBOUND = ["inbound_demo", "referral"];

const queueColumns = {
  id: s.leads.id,
  score: s.leads.score,
  status: s.leads.status,
  source: s.leads.source,
  attemptCount: s.leads.attemptCount,
  nextActionAt: s.leads.nextActionAt,
  nextActionType: s.leads.nextActionType,
  nextActionReason: s.leads.nextActionReason,
  createdAt: s.leads.createdAt,
  ownerId: s.leads.ownerId,
  campaignId: s.leads.campaignId,
  timezone: s.contacts.timezone,
  firstName: s.contacts.firstName,
  lastName: s.contacts.lastName,
  title: s.contacts.title,
  companyName: s.companies.name,
};

export type QueueLead = RankedLead<{
  id: string;
  score: number;
  status: string;
  source: string;
  attemptCount: number;
  nextActionAt: Date | null;
  nextActionType: string | null;
  nextActionReason: string | null;
  createdAt: Date;
  ownerId: string | null;
  campaignId: string | null;
  timezone: string;
  firstName: string;
  lastName: string;
  title: string | null;
  companyName: string | null;
}>;

/**
 * The rep's Next Best Lead queue: their workable leads plus unassigned inbound leads (speed to
 * lead beats ownership), ranked by src/lib/domain/queue. Also returns what's coming up next so an
 * empty queue still tells the rep what to do.
 */
export async function getQueue(ctx: Ctx, opts: { campaignId?: string; skip?: string[] } = {}) {
  const db = await getDb();
  const now = new Date();
  const base = and(
    eq(s.leads.orgId, ctx.orgId),
    or(eq(s.leads.ownerId, ctx.userId), and(isNull(s.leads.ownerId), inArray(s.leads.source, INBOUND))),
    notInArray(s.leads.status, ["unqualified", "converted"]),
    ne(s.leads.nextActionType, "none"),
    eq(s.contacts.doNotCall, false),
    eq(s.contacts.phoneInvalid, false),
    opts.campaignId ? eq(s.leads.campaignId, opts.campaignId) : undefined,
  );
  const rows = await db
    .select(queueColumns)
    .from(s.leads)
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
    .where(base);
  const skip = new Set(opts.skip ?? []);
  const ranked = rankQueue(rows, now).map((r) => (r.lead.ownerId ? r : { ...r, reasons: ["Unassigned inbound — first to call claims it", ...r.reasons] }));
  const due = ranked.filter((r) => !skip.has(r.lead.id));
  const upcoming = rows
    .filter((r) => r.nextActionAt && r.nextActionAt > now)
    .sort((a, b) => a.nextActionAt!.getTime() - b.nextActionAt!.getTime())
    .slice(0, 12);
  return {
    due,
    skipped: ranked.filter((r) => skip.has(r.lead.id)).length,
    callbacks: due.filter((r) => r.lead.nextActionType === "callback").length,
    callableNow: due.filter((r) => r.callableNow).length,
    upcoming,
  };
}
