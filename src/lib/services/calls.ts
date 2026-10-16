import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { UserError } from "./errors";
import { getDb, schema as s } from "@/lib/db";
import { CONNECTED_DISPOSITIONS, DISPOSITION_MAP, type DispositionKey } from "@/lib/domain/dispositions";
import { buildCallOutcome } from "@/lib/domain/outcome";
import { providers } from "@/lib/providers";
import { canWorkLead, type Ctx } from "./context";
import { icpOf } from "./leads";

async function loadLeadForCall(ctx: Ctx, leadId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ lead: s.leads, contact: s.contacts, company: s.companies, org: s.organizations })
    .from(s.leads)
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
    .innerJoin(s.organizations, eq(s.organizations.id, s.leads.orgId))
    .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, leadId)));
  if (!row) throw new UserError("Lead not found");
  if (!canWorkLead(ctx, row.lead.ownerId)) throw new UserError("This lead belongs to another rep");
  return row;
}

/** Places a call through the configured phone provider. Unassigned leads are claimed by the caller. */
export async function startCall(ctx: Ctx, leadId: string, number: "phone" | "mobile") {
  const db = await getDb();
  const row = await loadLeadForCall(ctx, leadId);
  if (row.contact.doNotCall) throw new UserError("This contact is on the do-not-call list");
  const to = number === "mobile" ? row.contact.mobile : row.contact.phone;
  if (!to) throw new UserError("No number on file");

  // One live call per rep: close anything left dangling (e.g. a closed tab).
  await db
    .update(s.calls)
    .set({ status: "abandoned", endedAt: new Date() })
    .where(and(eq(s.calls.orgId, ctx.orgId), eq(s.calls.userId, ctx.userId), inArray(s.calls.status, ["in_progress", "completed"]), isNull(s.calls.disposition)));

  const callId = randomUUID();
  const phone = providers.phone();
  const placed = await phone.placeCall({ callId, to, fromUserId: ctx.userId });
  if (placed.status === "failed") throw new UserError(placed.error ?? "The call could not be placed");
  await db.transaction(async (tx) => {
    await tx.insert(s.calls).values({
      id: callId,
      orgId: ctx.orgId,
      leadId,
      userId: ctx.userId,
      provider: phone.id,
      providerCallId: placed.providerCallId,
      toNumber: to,
      status: "in_progress",
      startedAt: new Date(),
    });
    if (!row.lead.ownerId) {
      await tx.update(s.leads).set({ ownerId: ctx.userId, updatedAt: new Date() }).where(eq(s.leads.id, leadId));
      await tx.insert(s.activities).values({ orgId: ctx.orgId, leadId, companyId: row.lead.companyId, userId: ctx.userId, type: "assignment", title: "Claimed from the unassigned pool", meta: { ownerId: ctx.userId } });
    }
  });
  return { callId, startedAt: new Date(), provider: { id: phone.id, name: phone.name, live: phone.live } };
}

export async function endCall(ctx: Ctx, callId: string) {
  const db = await getDb();
  const [call] = await db.select().from(s.calls).where(and(eq(s.calls.orgId, ctx.orgId), eq(s.calls.id, callId), eq(s.calls.userId, ctx.userId)));
  if (!call) throw new UserError("Call not found");
  if (call.endedAt) return call;
  if (call.providerCallId) await providers.phone().hangup(call.providerCallId);
  const endedAt = new Date();
  const [updated] = await db
    .update(s.calls)
    .set({ endedAt, status: "completed", durationSec: Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000) })
    .where(eq(s.calls.id, callId))
    .returning();
  return updated;
}

export async function activeCall(ctx: Ctx, leadId: string) {
  const db = await getDb();
  const [call] = await db
    .select()
    .from(s.calls)
    .where(
      and(
        eq(s.calls.orgId, ctx.orgId),
        eq(s.calls.userId, ctx.userId),
        eq(s.calls.leadId, leadId),
        isNull(s.calls.disposition),
        // Live, or hung up but not yet logged (e.g. the rep refreshed before picking an outcome).
        inArray(s.calls.status, ["in_progress", "completed"]),
        gte(s.calls.startedAt, new Date(Date.now() - 2 * 3_600_000)),
      ),
    )
    .orderBy(desc(s.calls.startedAt))
    .limit(1);
  return call ?? null;
}

export interface LogCallInput {
  leadId: string;
  callId?: string | null;
  disposition: DispositionKey;
  notes?: string | null;
  callbackAt?: Date | null;
  meetingAt?: Date | null;
  reason?: string | null;
}

/**
 * The single write path for a call outcome: closes the call, writes the timeline, applies the
 * disposition rules (status, next action, cadence), supersedes stale auto-tasks, creates the
 * follow-up task / meeting / deal, updates contact flags and rescores — atomically.
 */
export async function logCallOutcome(ctx: Ctx, input: LogCallInput) {
  const db = await getDb();
  const def = DISPOSITION_MAP[input.disposition];
  if (def.requires === "callbackAt" && !input.callbackAt) throw new UserError("Pick a callback time");
  if (def.requires === "meeting" && !input.meetingAt) throw new UserError("Pick a meeting time");
  if (input.callbackAt && input.callbackAt.getTime() < Date.now() - 5 * 60_000) throw new UserError("Callback time is in the past");
  if (input.meetingAt && input.meetingAt.getTime() < Date.now() - 5 * 60_000) throw new UserError("Meeting time is in the past");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ lead: s.leads, contact: s.contacts, company: s.companies, org: s.organizations })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
      .innerJoin(s.organizations, eq(s.organizations.id, s.leads.orgId))
      .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, input.leadId)))
      .for("update", { of: s.leads });
    if (!row) throw new UserError("Lead not found");
    if (!canWorkLead(ctx, row.lead.ownerId)) throw new UserError("This lead belongs to another rep");
    const now = new Date();

    let callId = input.callId ?? null;
    let durationSec = 0;
    if (callId) {
      const [call] = await tx.select().from(s.calls).where(and(eq(s.calls.orgId, ctx.orgId), eq(s.calls.id, callId), eq(s.calls.leadId, input.leadId)));
      if (!call) throw new UserError("Call not found");
      if (call.disposition) throw new UserError("This call was already logged");
      const endedAt = call.endedAt ?? now;
      durationSec = call.durationSec ?? Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000);
      await tx
        .update(s.calls)
        .set({ endedAt, durationSec, status: "completed", disposition: input.disposition, notes: input.notes ?? null, answeredAt: def.connected ? call.startedAt : null })
        .where(eq(s.calls.id, callId));
    } else {
      // Logged without dialing through Phoonica (e.g. from a desk phone).
      callId = randomUUID();
      await tx.insert(s.calls).values({
        id: callId,
        orgId: ctx.orgId,
        leadId: input.leadId,
        userId: ctx.userId,
        provider: "manual",
        toNumber: row.contact.mobile ?? row.contact.phone ?? "",
        status: "completed",
        startedAt: now,
        endedAt: now,
        durationSec: 0,
        disposition: input.disposition,
        notes: input.notes ?? null,
      });
    }

    const [openDeal] = await tx
      .select({ id: s.deals.id })
      .from(s.deals)
      .innerJoin(s.pipelineStages, eq(s.pipelineStages.id, s.deals.stageId))
      .where(and(eq(s.deals.leadId, input.leadId), eq(s.pipelineStages.kind, "open")))
      .limit(1);
    const [meetingStage] = await tx
      .select({ id: s.pipelineStages.id })
      .from(s.pipelineStages)
      .where(and(eq(s.pipelineStages.orgId, ctx.orgId), eq(s.pipelineStages.kind, "open")))
      .orderBy(s.pipelineStages.position)
      .limit(1);

    const out = buildCallOutcome(
      {
        now,
        orgId: ctx.orgId,
        userId: ctx.userId,
        lead: row.lead,
        contact: row.contact,
        contactId: row.contact.id,
        company: row.company ? { name: row.company.name, industry: row.company.industry, employeeCount: row.company.employeeCount, annualRevenue: row.company.annualRevenue } : null,
        icp: icpOf(row.org),
        meetingStageId: meetingStage.id,
        hasOpenDeal: !!openDeal,
      },
      { disposition: input.disposition, callbackAt: input.callbackAt, meetingAt: input.meetingAt, reason: input.reason, notes: input.notes, durationSec, callId },
    );

    // Any open auto-task for this lead is superseded by this outcome.
    await tx
      .update(s.tasks)
      .set({ completedAt: now })
      .where(and(eq(s.tasks.leadId, input.leadId), eq(s.tasks.auto, true), isNull(s.tasks.completedAt)));
    if (out.deal) await tx.insert(s.deals).values(out.deal);
    if (out.meeting) {
      if (!out.meeting.dealId && openDeal) out.meeting.dealId = openDeal.id;
      const ev = await providers.calendar().createEvent({ title: out.meeting.title, start: out.meeting.scheduledAt, durationMin: out.meeting.durationMin, attendeeEmail: row.contact.email, organizerUserId: ctx.userId });
      await tx.insert(s.meetings).values({ ...out.meeting, calendarProvider: providers.calendar().id, externalId: ev.externalId });
    }
    if (out.task) await tx.insert(s.tasks).values({ ...out.task, dealId: out.task.dealId ?? openDeal?.id ?? null });
    await tx.insert(s.activities).values(out.activities);
    await tx
      .update(s.leads)
      .set({ ...out.leadPatch, ownerId: row.lead.ownerId ?? ctx.userId })
      .where(eq(s.leads.id, input.leadId));
    if (Object.keys(out.contactPatch).length) await tx.update(s.contacts).set(out.contactPatch).where(eq(s.contacts.id, row.contact.id));

    return {
      summary: out.plan.summary,
      disposition: def.label,
      dealId: out.deal?.id ?? null,
      contactName: `${row.contact.firstName} ${row.contact.lastName}`,
      nextActionAt: out.leadPatch.nextActionAt,
    };
  });
}

export async function todayStats(ctx: Ctx, since: Date, userId = ctx.userId) {
  const db = await getDb();
  const [r] = await db
    .select({
      dials: sql<number>`count(*)::int`,
      connects: sql<number>`count(*) filter (where ${inArray(s.calls.disposition, CONNECTED_DISPOSITIONS)})::int`,
      meetings: sql<number>`count(*) filter (where ${s.calls.disposition} = 'meeting_booked')::int`,
      talkSec: sql<number>`coalesce(sum(${s.calls.durationSec}) filter (where ${inArray(s.calls.disposition, CONNECTED_DISPOSITIONS)}), 0)::int`,
    })
    .from(s.calls)
    .where(and(eq(s.calls.orgId, ctx.orgId), eq(s.calls.userId, userId), gte(s.calls.startedAt, since), sql`${s.calls.disposition} is not null`));
  return r;
}
