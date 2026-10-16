// Turns a logged call into the full set of row changes (lead, contact, activity, task, meeting,
// deal). Pure: the live service persists the result in one transaction; the demo-data
// simulation applies the exact same rules in memory, so seeded history is consistent with use.

import { randomUUID } from "node:crypto";
import type { ScoreFactor } from "@/lib/db/schema";
import { DISPOSITION_MAP, LEAD_STATUS_MAP, planDisposition, type DispositionInput, type LeadCallState, type LeadStatus } from "./dispositions";
import { scoreLead, type ScoringInput } from "./scoring";

export interface OutcomeLead extends LeadCallState {
  id: string;
  companyId: string | null;
  source: string;
  score: number;
  createdAt: Date;
}

export interface OutcomeContact {
  firstName: string;
  lastName: string;
  timezone: string;
  seniority: string | null;
  phone: string | null;
  mobile: string | null;
  phoneInvalid: boolean;
  doNotCall: boolean;
}

export interface OutcomeContext {
  now: Date;
  orgId: string;
  userId: string;
  lead: OutcomeLead;
  contact: OutcomeContact;
  contactId: string;
  company: (ScoringInput["company"] & { name: string }) | null;
  icp: ScoringInput["icp"];
  meetingStageId: string;
  hasOpenDeal: boolean;
}

export interface CallOutcomeInput extends DispositionInput {
  notes?: string | null;
  durationSec: number;
  callId: string;
}

export function estimateDealValue(employees: number | null | undefined) {
  // Per-technician seat pricing: ~35% of headcount are field techs at $49/seat/month.
  const seats = Math.max(5, Math.round((employees ?? 30) * 0.35));
  return Math.round((seats * 49 * 12) / 500) * 500;
}

export function rescore(lead: LeadCallState & { source: string; createdAt: Date }, contact: OutcomeContact, company: ScoringInput["company"], icp: ScoringInput["icp"], now: Date) {
  return scoreLead(
    {
      status: lead.status,
      source: lead.source,
      attemptCount: lead.attemptCount,
      connectCount: lead.connectCount,
      lastDisposition: lead.lastDisposition,
      createdAt: lead.createdAt,
      contact,
      company,
      icp,
    },
    now,
  );
}

export function buildCallOutcome(ctx: OutcomeContext, input: CallOutcomeInput) {
  const { now, lead, contact } = ctx;
  const name = `${contact.firstName} ${contact.lastName}`;
  const def = DISPOSITION_MAP[input.disposition];
  const plan = planDisposition(lead, input, now, contact.timezone, name);
  const nextContact = { ...contact, ...plan.contactPatch };
  const { score, factors } = rescore({ ...plan.lead, source: lead.source, createdAt: lead.createdAt }, nextContact, ctx.company, ctx.icp, now);

  const statusChanged = plan.lead.status !== lead.status;
  const activities: ActivityInsert[] = [
    {
      id: randomUUID(),
      orgId: ctx.orgId,
      leadId: lead.id,
      companyId: lead.companyId,
      userId: ctx.userId,
      callId: input.callId,
      type: "call",
      disposition: input.disposition,
      title: `Call · ${def.label}`,
      body: input.notes?.trim() || null,
      meta: {
        durationSec: input.durationSec,
        summary: plan.summary,
        ...(plan.lead.unqualifiedReason ? { reason: plan.lead.unqualifiedReason } : {}),
        ...(statusChanged ? { statusFrom: lead.status, statusTo: plan.lead.status } : {}),
        scoreFrom: lead.score,
        scoreTo: score,
      },
      occurredAt: now,
    },
  ];

  let deal: DealInsert | null = null;
  let meeting: MeetingInsert | null = null;
  if (plan.meeting) {
    if (plan.openDeal && !ctx.hasOpenDeal) {
      deal = {
        id: randomUUID(),
        orgId: ctx.orgId,
        leadId: lead.id,
        companyId: lead.companyId,
        contactId: ctx.contactId,
        ownerId: ctx.userId,
        stageId: ctx.meetingStageId,
        name: `${ctx.company?.name ?? name} — New business`,
        value: estimateDealValue(ctx.company?.employeeCount),
        expectedCloseDate: new Date(now.getTime() + 45 * 86_400_000).toISOString().slice(0, 10),
        nextStep: "Run discovery call",
        stageChangedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      activities.push({
        id: randomUUID(),
        orgId: ctx.orgId,
        leadId: lead.id,
        companyId: lead.companyId,
        dealId: deal.id,
        userId: ctx.userId,
        type: "deal_created",
        title: `Deal opened · ${deal.name}`,
        body: null,
        meta: { value: deal.value, stage: "Meeting Booked" },
        occurredAt: now,
      });
    }
    meeting = {
      id: randomUUID(),
      orgId: ctx.orgId,
      leadId: lead.id,
      dealId: deal?.id ?? null,
      userId: ctx.userId,
      title: plan.meeting.title,
      scheduledAt: plan.meeting.scheduledAt,
      durationMin: 30,
      status: "scheduled",
      calendarProvider: "demo",
      createdAt: now,
    };
    activities.push({
      id: randomUUID(),
      orgId: ctx.orgId,
      leadId: lead.id,
      companyId: lead.companyId,
      dealId: deal?.id ?? null,
      userId: ctx.userId,
      type: "meeting_booked",
      title: "Meeting booked",
      body: plan.meeting.title,
      meta: { scheduledAt: plan.meeting.scheduledAt.toISOString(), meetingId: meeting.id },
      occurredAt: now,
    });
  }

  const task: TaskInsert | null = plan.task
    ? {
        id: randomUUID(),
        orgId: ctx.orgId,
        leadId: lead.id,
        dealId: deal?.id ?? null,
        assigneeId: ctx.userId,
        createdById: ctx.userId,
        type: plan.task.type,
        title: plan.task.title,
        dueAt: plan.task.dueAt,
        auto: true,
        createdAt: now,
      }
    : null;

  return {
    plan,
    leadPatch: { ...plan.lead, score, scoreFactors: factors as ScoreFactor[], updatedAt: now },
    contactPatch: plan.contactPatch,
    activities,
    task,
    meeting,
    deal,
  };
}

export function statusLabel(s: LeadStatus) {
  return LEAD_STATUS_MAP[s].label;
}

export interface ActivityInsert {
  id: string;
  orgId: string;
  leadId: string | null;
  companyId: string | null;
  dealId?: string | null;
  userId: string | null;
  callId?: string | null;
  type: string;
  disposition?: string | null;
  title: string;
  body: string | null;
  meta: Record<string, unknown>;
  occurredAt: Date;
}

export interface TaskInsert {
  id: string;
  orgId: string;
  leadId: string | null;
  dealId: string | null;
  assigneeId: string | null;
  createdById: string | null;
  type: string;
  title: string;
  notes?: string | null;
  dueAt: Date;
  completedAt?: Date | null;
  auto: boolean;
  createdAt: Date;
}

export interface MeetingInsert {
  id: string;
  orgId: string;
  leadId: string | null;
  dealId: string | null;
  userId: string | null;
  title: string;
  scheduledAt: Date;
  durationMin: number;
  status: string;
  calendarProvider: string | null;
  createdAt: Date;
}

export interface DealInsert {
  id: string;
  orgId: string;
  leadId: string | null;
  companyId: string | null;
  contactId: string | null;
  ownerId: string | null;
  stageId: string;
  name: string;
  value: number;
  expectedCloseDate: string | null;
  nextStep: string | null;
  stageChangedAt: Date;
  closedAt?: Date | null;
  lostReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
