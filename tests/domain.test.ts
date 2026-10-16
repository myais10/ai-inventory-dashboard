import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_ATTEMPTS, planDisposition, type LeadCallState } from "../src/lib/domain/dispositions";
import { rankQueue } from "../src/lib/domain/queue";
import { scoreLead } from "../src/lib/domain/scoring";
import { addBusinessDays, isCallingHours, localParts, nextCallingTime, parseLocalInput, zonedDate } from "../src/lib/domain/time";

const NY = "America/New_York";
// Tue 2026-10-13 10:00 New York
const tueMorning = zonedDate(2026, 10, 13, 10, 0, NY);

const fresh: LeadCallState = {
  status: "new",
  attemptCount: 0,
  connectCount: 0,
  lastContactedAt: null,
  lastDisposition: null,
  nextActionAt: null,
  nextActionType: "call",
  nextActionReason: null,
  unqualifiedReason: null,
};

describe("time", () => {
  it("zonedDate round-trips wall time across DST", () => {
    const d = zonedDate(2026, 11, 2, 9, 30, NY); // after DST ends
    assert.equal(localParts(d, NY).hour, 9);
    assert.equal(localParts(d, NY).minute, 30);
  });
  it("calling hours respect weekends and the contact's timezone", () => {
    assert.equal(isCallingHours(tueMorning, NY), true);
    assert.equal(isCallingHours(tueMorning, "America/Los_Angeles"), false); // 7am PT
    assert.equal(isCallingHours(zonedDate(2026, 10, 17, 11, 0, NY), NY), false); // Saturday
  });
  it("nextCallingTime rolls Friday evening to Monday morning", () => {
    const t = nextCallingTime(zonedDate(2026, 10, 16, 18, 0, NY), NY);
    const p = localParts(t, NY);
    assert.equal(p.weekday, "Mon");
    assert.equal(p.hour, 9);
  });
  it("addBusinessDays skips weekends", () => {
    assert.equal(localParts(addBusinessDays(zonedDate(2026, 10, 16, 10, 0, NY), 1, NY), NY).weekday, "Mon");
  });
  it("parseLocalInput reads wall time in the given zone", () => {
    const d = parseLocalInput("2026-10-19T14:00", "America/Chicago")!;
    assert.equal(localParts(d, "America/Chicago").hour, 14);
  });
});

describe("dispositions", () => {
  it("no answer escalates the retry cadence", () => {
    const a1 = planDisposition(fresh, { disposition: "no_answer" }, tueMorning, NY, "Ann");
    assert.equal(a1.lead.status, "attempting");
    assert.equal(a1.lead.attemptCount, 1);
    const hours1 = (a1.lead.nextActionAt!.getTime() - tueMorning.getTime()) / 3_600_000;
    const a2 = planDisposition(a1.lead, { disposition: "no_answer" }, tueMorning, NY, "Ann");
    const hours2 = (a2.lead.nextActionAt!.getTime() - tueMorning.getTime()) / 3_600_000;
    assert.ok(hours1 <= 4 && hours2 >= 24, `${hours1} then ${hours2}`);
  });
  it("moves to nurture after MAX_ATTEMPTS unanswered calls", () => {
    let s = fresh;
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = planDisposition(s, { disposition: "no_answer" }, tueMorning, NY, "Ann").lead;
    assert.equal(s.status, "nurture");
  });
  it("not-connected outcomes never downgrade a connected lead", () => {
    const connected = { ...fresh, status: "connected" as const, connectCount: 1, attemptCount: 2 };
    assert.equal(planDisposition(connected, { disposition: "voicemail" }, tueMorning, NY, "Ann").lead.status, "connected");
  });
  it("callback schedules a callback task at the requested time and keeps the lead queued", () => {
    const at = zonedDate(2026, 10, 14, 15, 0, NY);
    const p = planDisposition(fresh, { disposition: "callback", callbackAt: at }, tueMorning, NY, "Ann");
    assert.equal(p.lead.nextActionType, "callback");
    assert.equal(p.lead.nextActionAt!.getTime(), at.getTime());
    assert.equal(p.task?.type, "callback");
    assert.equal(p.lead.connectCount, 1);
  });
  it("meeting booked qualifies, books a meeting and opens a deal", () => {
    const p = planDisposition(fresh, { disposition: "meeting_booked", meetingAt: zonedDate(2026, 10, 15, 10, 0, NY) }, tueMorning, NY, "Ann");
    assert.equal(p.lead.status, "qualified");
    assert.equal(p.lead.nextActionType, "none");
    assert.ok(p.meeting && p.openDeal);
  });
  it("do not call and wrong number update contact flags and leave the queue", () => {
    const dnc = planDisposition(fresh, { disposition: "do_not_call" }, tueMorning, NY, "Ann");
    assert.deepEqual(dnc.contactPatch, { doNotCall: true });
    assert.equal(dnc.lead.status, "unqualified");
    const wrong = planDisposition(fresh, { disposition: "wrong_number" }, tueMorning, NY, "Ann");
    assert.deepEqual(wrong.contactPatch, { phoneInvalid: true });
    assert.equal(wrong.lead.nextActionType, "none");
  });
});

describe("scoring", () => {
  const icp = { industries: ["HVAC"], minEmployees: 25, maxEmployees: 1000 };
  const base = {
    status: "new" as const,
    source: "outbound_list",
    attemptCount: 0,
    connectCount: 0,
    lastDisposition: null,
    createdAt: new Date(tueMorning.getTime() - 30 * 86_400_000),
    contact: { seniority: "manager", phone: "+15555550100", mobile: null, phoneInvalid: false, doNotCall: false },
    company: { industry: "Retail", employeeCount: 10, annualRevenue: 1_000_000 },
    icp,
  };
  it("rewards ICP fit, seniority and inbound intent, and explains every point", () => {
    const low = scoreLead(base, tueMorning);
    const high = scoreLead({ ...base, source: "inbound_demo", contact: { ...base.contact, seniority: "c_level", mobile: "+15555550101" }, company: { industry: "HVAC", employeeCount: 200, annualRevenue: 30_000_000 } }, tueMorning);
    assert.ok(high.score > low.score + 40);
    assert.equal(high.score, Math.min(100, high.factors.reduce((a, f) => a + f.points, 0)));
  });
  it("penalises unreachable leads and bad data, clamped at 0", () => {
    const r = scoreLead({ ...base, attemptCount: 8, contact: { ...base.contact, phoneInvalid: true, doNotCall: true } }, tueMorning);
    assert.equal(r.score, 0);
    assert.ok(r.factors.some((f) => f.key === "unreachable"));
  });
});

describe("Next Best Lead", () => {
  const lead = (o: Partial<Parameters<typeof rankQueue>[0][number]>) => ({
    id: Math.random().toString(36),
    score: 40,
    status: "attempting",
    source: "outbound_list",
    attemptCount: 2,
    nextActionAt: new Date(tueMorning.getTime() - 3_600_000),
    nextActionType: "call",
    createdAt: new Date(tueMorning.getTime() - 10 * 86_400_000),
    timezone: NY,
    ...o,
  });
  it("puts due callbacks and fresh inbound leads ahead of higher-scored cold retries", () => {
    const ranked = rankQueue(
      [
        lead({ id: "cold", score: 80 }),
        lead({ id: "callback", score: 30, nextActionType: "callback" }),
        lead({ id: "inbound", score: 40, source: "inbound_demo", attemptCount: 0, nextActionAt: null, status: "new", createdAt: new Date(tueMorning.getTime() - 600_000) }),
      ],
      tueMorning,
    );
    assert.deepEqual(ranked.map((r) => r.lead.id), ["callback", "inbound", "cold"]);
    assert.ok(ranked[0].reasons[0].includes("callback"));
  });
  it("excludes leads not yet due or with no next action, and sinks out-of-hours contacts", () => {
    const ranked = rankQueue(
      [
        lead({ id: "later", nextActionAt: new Date(tueMorning.getTime() + 3_600_000) }),
        lead({ id: "none", nextActionType: "none" }),
        lead({ id: "west", score: 90, timezone: "America/Los_Angeles" }),
        lead({ id: "east", score: 40 }),
      ],
      tueMorning,
    );
    assert.deepEqual(ranked.map((r) => r.lead.id), ["east", "west"]);
    assert.equal(ranked[1].callableNow, false);
  });
});
