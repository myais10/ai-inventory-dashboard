// Call dispositions and the rules that turn an outcome into the lead's next action.
// Pure and deterministic: used by the live Calling Desk and by the demo-data simulation.

import { addBusinessDays, addHours, nextCallingTime } from "./time";

export type LeadStatus = "new" | "attempting" | "connected" | "qualified" | "nurture" | "unqualified" | "converted";

export type DispositionKey =
  | "no_answer"
  | "voicemail"
  | "busy"
  | "gatekeeper"
  | "interested"
  | "callback"
  | "meeting_booked"
  | "not_interested"
  | "wrong_number"
  | "do_not_call";

export interface DispositionDef {
  key: DispositionKey;
  label: string;
  shortcut: string;
  connected: boolean;
  tone: "slate" | "amber" | "green" | "brand" | "red" | "violet";
  /** What the rep sees before saving: the automatic consequence. */
  effect: string;
  requires?: "callbackAt" | "meeting" | "reason";
}

export const DISPOSITIONS: DispositionDef[] = [
  { key: "no_answer", label: "No answer", shortcut: "1", connected: false, tone: "slate", effect: "Retry on an escalating cadence; moves to nurture after 6 attempts" },
  { key: "voicemail", label: "Left voicemail", shortcut: "2", connected: false, tone: "slate", effect: "Retry in 2 business days" },
  { key: "busy", label: "Busy", shortcut: "3", connected: false, tone: "slate", effect: "Retry in 1 hour" },
  { key: "gatekeeper", label: "Gatekeeper", shortcut: "4", connected: false, tone: "amber", effect: "Retry next business day" },
  { key: "interested", label: "Interested", shortcut: "5", connected: true, tone: "green", effect: "Follow-up call in 2 business days" },
  { key: "callback", label: "Callback requested", shortcut: "6", connected: true, tone: "brand", effect: "Callback task at the time you choose; jumps to top of queue", requires: "callbackAt" },
  { key: "meeting_booked", label: "Meeting booked", shortcut: "7", connected: true, tone: "violet", effect: "Qualifies lead, books meeting, opens a deal in the pipeline", requires: "meeting" },
  { key: "not_interested", label: "Not interested", shortcut: "8", connected: true, tone: "red", effect: "Marks unqualified and removes from queue", requires: "reason" },
  { key: "wrong_number", label: "Wrong number", shortcut: "9", connected: false, tone: "red", effect: "Flags phone invalid; parks lead until number is fixed" },
  { key: "do_not_call", label: "Do not call", shortcut: "0", connected: true, tone: "red", effect: "Adds contact to do-not-call; never queued again" },
];

export const DISPOSITION_MAP = Object.fromEntries(DISPOSITIONS.map((d) => [d.key, d])) as Record<DispositionKey, DispositionDef>;
export const CONNECTED_DISPOSITIONS = DISPOSITIONS.filter((d) => d.connected).map((d) => d.key);
export const DISPOSITION_KEYS = DISPOSITIONS.map((d) => d.key) as [DispositionKey, ...DispositionKey[]];

export const NOT_INTERESTED_REASONS = ["No need", "Using a competitor", "No budget", "Bad timing", "Too small", "Other"] as const;

export const MAX_ATTEMPTS = 6;

export interface LeadCallState {
  status: LeadStatus;
  attemptCount: number;
  connectCount: number;
  lastContactedAt: Date | null;
  lastDisposition: string | null;
  nextActionAt: Date | null;
  nextActionType: string | null;
  nextActionReason: string | null;
  unqualifiedReason: string | null;
}

export interface DispositionInput {
  disposition: DispositionKey;
  callbackAt?: Date | null;
  meetingAt?: Date | null;
  reason?: string | null;
}

export interface DispositionPlan {
  lead: LeadCallState;
  contactPatch: { doNotCall?: boolean; phoneInvalid?: boolean };
  task: { type: string; title: string; dueAt: Date } | null;
  meeting: { scheduledAt: Date; title: string } | null;
  openDeal: boolean;
  summary: string;
}

// Escalating no-answer cadence (hours or business days) by attempt number.
function noAnswerRetry(attempt: number, now: Date, tz: string): { at: Date; label: string } {
  if (attempt <= 1) return { at: nextCallingTime(addHours(now, 3), tz), label: "Retry later today" };
  if (attempt === 2) return { at: addBusinessDays(now, 1, tz), label: "Retry next business day" };
  if (attempt === 3) return { at: addBusinessDays(now, 2, tz), label: "Retry in 2 business days" };
  return { at: addBusinessDays(now, 3, tz), label: "Retry in 3 business days" };
}

const ADVANCED: LeadStatus[] = ["connected", "qualified", "converted"];

export function planDisposition(prev: LeadCallState, input: DispositionInput, now: Date, tz: string, contactName: string): DispositionPlan {
  const def = DISPOSITION_MAP[input.disposition];
  const attemptCount = prev.attemptCount + 1;
  const connectCount = prev.connectCount + (def.connected ? 1 : 0);
  const base: LeadCallState = {
    ...prev,
    attemptCount,
    connectCount,
    lastContactedAt: now,
    lastDisposition: input.disposition,
    unqualifiedReason: null,
  };
  // Not-connected outcomes never downgrade a lead that has already been reached.
  const keepOrAttempting: LeadStatus = ADVANCED.includes(prev.status) ? prev.status : "attempting";
  const plan = (lead: Partial<LeadCallState>, extra: Partial<DispositionPlan> = {}): DispositionPlan => ({
    lead: { ...base, ...lead },
    contactPatch: {},
    task: null,
    meeting: null,
    openDeal: false,
    summary: "",
    ...extra,
  });

  switch (input.disposition) {
    case "no_answer": {
      const unreachedAttempts = attemptCount - prev.connectCount;
      if (prev.connectCount === 0 && unreachedAttempts >= MAX_ATTEMPTS) {
        const at = addBusinessDays(now, 20, tz);
        return plan(
          { status: "nurture", nextActionAt: at, nextActionType: "call", nextActionReason: `${MAX_ATTEMPTS} attempts without a connect — nurture and retry in ~4 weeks` },
          { summary: `Moved to nurture after ${MAX_ATTEMPTS} unanswered attempts` },
        );
      }
      const r = noAnswerRetry(attemptCount, now, tz);
      return plan(
        { status: keepOrAttempting, nextActionAt: r.at, nextActionType: "call", nextActionReason: `No answer on attempt ${attemptCount} — ${r.label.toLowerCase()}` },
        { summary: r.label },
      );
    }
    case "voicemail": {
      const at = addBusinessDays(now, 2, tz);
      return plan(
        { status: keepOrAttempting, nextActionAt: at, nextActionType: "call", nextActionReason: "Left voicemail — give them 2 business days to call back" },
        { summary: "Retry in 2 business days" },
      );
    }
    case "busy": {
      const at = nextCallingTime(addHours(now, 1), tz);
      return plan({ status: keepOrAttempting, nextActionAt: at, nextActionType: "call", nextActionReason: "Line was busy — retry in an hour" }, { summary: "Retry in 1 hour" });
    }
    case "gatekeeper": {
      const at = addBusinessDays(now, 1, tz);
      return plan(
        { status: keepOrAttempting, nextActionAt: at, nextActionType: "call", nextActionReason: "Blocked by gatekeeper — try again next business day, ideally early or late" },
        { summary: "Retry next business day" },
      );
    }
    case "interested": {
      const at = addBusinessDays(now, 2, tz);
      return plan(
        { status: prev.status === "qualified" ? "qualified" : "connected", nextActionAt: at, nextActionType: "call", nextActionReason: "Showed interest — follow up to book a meeting" },
        { task: { type: "follow_up", title: `Follow up with ${contactName} to book a meeting`, dueAt: at }, summary: "Follow-up in 2 business days" },
      );
    }
    case "callback": {
      const at = input.callbackAt ?? addBusinessDays(now, 1, tz);
      return plan(
        { status: prev.status === "qualified" ? "qualified" : "connected", nextActionAt: at, nextActionType: "callback", nextActionReason: "Callback requested by the contact" },
        { task: { type: "callback", title: `Call back ${contactName} (requested)`, dueAt: at }, summary: "Callback scheduled" },
      );
    }
    case "meeting_booked": {
      const at = input.meetingAt ?? addBusinessDays(now, 3, tz);
      return plan(
        { status: "qualified", nextActionAt: null, nextActionType: "none", nextActionReason: "Meeting booked — the deal now drives next steps" },
        {
          meeting: { scheduledAt: at, title: `Discovery call with ${contactName}` },
          task: { type: "meeting_prep", title: `Prepare for discovery call with ${contactName}`, dueAt: addHours(at, -2) },
          openDeal: true,
          summary: "Meeting booked and deal opened",
        },
      );
    }
    case "not_interested":
      return plan(
        { status: "unqualified", nextActionAt: null, nextActionType: "none", nextActionReason: null, unqualifiedReason: input.reason || "Not interested" },
        { summary: "Marked unqualified" },
      );
    case "wrong_number":
      return plan(
        { status: prev.status === "new" ? "attempting" : prev.status, nextActionAt: null, nextActionType: "none", nextActionReason: "Phone number is wrong — update it to re-queue this lead" },
        { contactPatch: { phoneInvalid: true }, summary: "Phone flagged invalid" },
      );
    case "do_not_call":
      return plan(
        { status: "unqualified", nextActionAt: null, nextActionType: "none", nextActionReason: null, unqualifiedReason: "Requested do-not-call" },
        { contactPatch: { doNotCall: true }, summary: "Added to do-not-call" },
      );
  }
}

export const LEAD_STATUSES: { key: LeadStatus; label: string; tone: "slate" | "amber" | "green" | "brand" | "red" | "violet" | "blue" }[] = [
  { key: "new", label: "New", tone: "blue" },
  { key: "attempting", label: "Attempting", tone: "amber" },
  { key: "connected", label: "Connected", tone: "brand" },
  { key: "qualified", label: "Qualified", tone: "green" },
  { key: "nurture", label: "Nurture", tone: "slate" },
  { key: "unqualified", label: "Unqualified", tone: "red" },
  { key: "converted", label: "Converted", tone: "violet" },
];
export const LEAD_STATUS_MAP = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, s])) as Record<LeadStatus, (typeof LEAD_STATUSES)[number]>;
