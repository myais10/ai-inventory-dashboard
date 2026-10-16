// Realistic demo workspace. Instead of hand-placing mock rows, this *simulates* ~6 weeks of an SDR
// team working its queue: every call is chosen by the real Next Best Lead ranking and resolved by
// the real disposition engine (src/lib/domain), so timelines, statuses, scores, tasks, meetings,
// deals and analytics are all mutually consistent.

import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import type { DispositionKey, LeadStatus } from "@/lib/domain/dispositions";
import { buildCallOutcome, rescore, type ActivityInsert, type DealInsert, type MeetingInsert, type TaskInsert } from "@/lib/domain/outcome";
import { rankQueue } from "@/lib/domain/queue";
import { addBusinessDays, addHours, localParts, nextCallingTime, zonedDate } from "@/lib/domain/time";
import { createRng, hashString } from "@/lib/utils";
import type { DB, Executor } from "./index";
import * as s from "./schema";

export const DEMO_PASSWORD = "phoonica-demo";
export const DEMO_ORG = "Brightline Field Software";
export const DEMO_ACCOUNTS = [
  { email: "jordan@brightline.demo", name: "Jordan Reyes", role: "owner" as const, title: "VP of Sales" },
  { email: "dana@brightline.demo", name: "Dana Brooks", role: "manager" as const, title: "SDR Manager" },
  { email: "sam@brightline.demo", name: "Sam Whitfield", role: "rep" as const, title: "Sales Development Rep" },
  { email: "priya@brightline.demo", name: "Priya Shah", role: "rep" as const, title: "Sales Development Rep" },
  { email: "marcus@brightline.demo", name: "Marcus Lee", role: "rep" as const, title: "Sales Development Rep" },
  { email: "elena@brightline.demo", name: "Elena García", role: "rep" as const, title: "Senior SDR" },
];

export const DEFAULT_STAGES = [
  { name: "Meeting Booked", probability: 20, kind: "open" as const },
  { name: "Discovery", probability: 30, kind: "open" as const },
  { name: "Demo", probability: 50, kind: "open" as const },
  { name: "Proposal", probability: 70, kind: "open" as const },
  { name: "Negotiation", probability: 85, kind: "open" as const },
  { name: "Closed Won", probability: 100, kind: "won" as const },
  { name: "Closed Lost", probability: 0, kind: "lost" as const },
];

const ICP = ["HVAC", "Plumbing", "Electrical", "Facilities Management", "Pest Control", "Security Systems"];
const ORG_TZ = "America/New_York";

const CITIES: [string, string, string, string][] = [
  ["Atlanta", "GA", "America/New_York", "404"], ["Charlotte", "NC", "America/New_York", "704"], ["Tampa", "FL", "America/New_York", "813"],
  ["Columbus", "OH", "America/New_York", "614"], ["Philadelphia", "PA", "America/New_York", "215"], ["Boston", "MA", "America/New_York", "617"],
  ["Raleigh", "NC", "America/New_York", "919"], ["Orlando", "FL", "America/New_York", "407"], ["Chicago", "IL", "America/Chicago", "312"],
  ["Dallas", "TX", "America/Chicago", "214"], ["Houston", "TX", "America/Chicago", "713"], ["Austin", "TX", "America/Chicago", "512"],
  ["Minneapolis", "MN", "America/Chicago", "612"], ["Nashville", "TN", "America/Chicago", "615"], ["Kansas City", "MO", "America/Chicago", "816"],
  ["Denver", "CO", "America/Denver", "303"], ["Phoenix", "AZ", "America/Phoenix", "602"], ["Salt Lake City", "UT", "America/Denver", "801"],
  ["Seattle", "WA", "America/Los_Angeles", "206"], ["Portland", "OR", "America/Los_Angeles", "503"], ["San Diego", "CA", "America/Los_Angeles", "619"],
  ["Sacramento", "CA", "America/Los_Angeles", "916"], ["Las Vegas", "NV", "America/Los_Angeles", "702"],
];

const INDUSTRY_WORDS: Record<string, string[]> = {
  HVAC: ["Air", "Comfort Systems", "Heating & Cooling", "Mechanical", "Climate Control"],
  Plumbing: ["Plumbing", "Pipe & Drain", "Plumbing & Rooter", "Water Services"],
  Electrical: ["Electric", "Electrical Contractors", "Power Services", "Electrical"],
  "Facilities Management": ["Facility Services", "Building Services", "Property Maintenance"],
  "Pest Control": ["Pest Control", "Pest Solutions", "Exterminating"],
  "Security Systems": ["Security", "Alarm & Video", "Protection Systems"],
  Landscaping: ["Landscapes", "Lawn & Garden", "Grounds Care"],
  Logistics: ["Logistics", "Freight", "Delivery"],
  Retail: ["Supply Co.", "Outfitters", "Hardware"],
};
const INDUSTRY_WEIGHTS: [string, number][] = [
  ["HVAC", 24], ["Plumbing", 18], ["Electrical", 14], ["Facilities Management", 10], ["Pest Control", 8], ["Security Systems", 8], ["Landscaping", 8], ["Logistics", 5], ["Retail", 5],
];
const PREFIXES = [
  "Summit", "Clearwater", "Ironwood", "Blue Ridge", "Northgate", "Keystone", "Redline", "Lakeshore", "Pioneer", "Evergreen", "Granite", "Silverline",
  "Harbor", "Precision", "Allied", "Premier", "Cardinal", "Liberty", "Frontier", "Metro", "Copperfield", "Westbrook", "Oak Valley", "Sterling",
  "Patriot", "Trinity", "Apex", "Riverbend", "Highland", "Coastal", "Prairie", "Cornerstone", "Benchmark", "Canyon", "Magnolia", "Sunbelt",
  "Tri-County", "Reliance", "Bayside", "Hometown", "Eagle", "Crestview", "Union", "Bridgeport", "Foxhall", "Mesa", "Juniper", "Ridgeline",
];
const SUFFIXES = ["", "", " Inc.", " LLC", " Co.", " Group", " Services"];
const FIRST = [
  "James", "Maria", "Robert", "Linda", "Michael", "Jennifer", "David", "Patricia", "Carlos", "Aisha", "Kevin", "Megan", "Brian", "Rachel", "Luis",
  "Tanya", "Derek", "Nicole", "Tom", "Sofia", "Andre", "Heather", "Greg", "Monica", "Raj", "Erin", "Victor", "Kim", "Daniel", "Lauren", "Omar",
  "Becky", "Hector", "Amanda", "Wes", "Grace", "Tyrone", "Kelly", "Chris", "Ana", "Paul", "Jasmine", "Mark", "Holly", "Ben", "Leah", "Frank", "Nina",
];
const LAST = [
  "Johnson", "Martinez", "Nguyen", "Brown", "Patel", "Williams", "Garcia", "Miller", "Davis", "Rodriguez", "Wilson", "Anderson", "Thomas", "Taylor",
  "Moore", "Jackson", "Lee", "Harris", "Clark", "Lewis", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Lopez", "Hill", "Scott", "Green",
  "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins",
  "Stewart", "Morris", "Murphy", "Cook", "Rogers", "Morgan", "Reed", "Bailey", "Bell", "Kim", "Okafor", "Novak", "Hughes", "Price", "Ramos",
];
const TITLES: Record<string, string[]> = {
  c_level: ["Owner", "CEO", "President", "COO"],
  vp: ["VP of Operations", "VP of Service", "VP of Field Operations"],
  director: ["Director of Operations", "Director of Service", "Director of Field Services"],
  manager: ["Operations Manager", "Service Manager", "Dispatch Manager", "Field Service Manager"],
  individual: ["Office Manager", "Lead Dispatcher", "Service Coordinator"],
};

const NOTES: Partial<Record<DispositionKey, string[]>> = {
  voicemail: [
    "Left VM about cutting drive time between jobs. Mentioned other {ind} shops in {city}.",
    "VM: referenced their job postings for dispatchers — scheduling load is growing.",
    "Short VM, will follow with a call Thursday.",
  ],
  gatekeeper: [
    "Front desk took a message. Ask for {first} directly before 8:30am.",
    "Receptionist says {first} is out on a job site most days — try end of day.",
  ],
  interested: [
    "Running dispatch off a whiteboard + spreadsheets, {n} techs. Wants pricing and a short overview.",
    "Current software is clunky on mobile, techs hate it. Open to a look next week.",
    "Growing fast — just added a second location. Interested in route optimization.",
    "Pain: missed appointments and paper work orders. Asked for a case study.",
  ],
  callback: [
    "In the field — asked to call back tomorrow morning.",
    "Busy with month-end, call back after Monday's ops meeting.",
    "Asked me to call back when the owner is in.",
  ],
  meeting_booked: [
    "Booked discovery with {first} + ops lead. {n} techs, losing ~5 jobs/week to scheduling gaps.",
    "Discovery booked. Evaluating options before peak season, budget approved.",
    "Meeting set. Wants to see dispatch board + invoicing in the field.",
  ],
  not_interested: [
    "Just renewed with current vendor, revisit in 12 months.",
    "Too small right now — owner does all scheduling himself.",
    "Not a priority this year.",
  ],
  wrong_number: ["Number goes to a different business."],
  do_not_call: ["Asked to be removed from all lists."],
};

const LOST_REASONS = ["Chose competitor", "No budget", "Went dark", "Timing — revisit next year", "Too complex for their team"];
const STAGE_NEXT_STEPS: Record<string, string> = {
  "Meeting Booked": "Run discovery call",
  Discovery: "Schedule product demo with ops team",
  Demo: "Send proposal",
  Proposal: "Review proposal with decision maker",
  Negotiation: "Finalize contract terms",
};
const STAGE_TASKS: Record<string, { title: string; type: string }> = {
  Discovery: { title: "Send discovery recap to {first}", type: "email" },
  Demo: { title: "Prep tailored demo for {company}", type: "meeting_prep" },
  Proposal: { title: "Send proposal to {company}", type: "email" },
  Negotiation: { title: "Call {first} about contract redlines", type: "call" },
};

type Rng = ReturnType<typeof createRng>;

function weighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}

function fill(t: string, vars: Record<string, string | number>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

async function insertChunked<T extends object>(db: Executor, table: Parameters<Executor["insert"]>[0], rows: T[], size = 250) {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

// ---------- Entry points ----------

export async function seedIfEmpty(db: DB) {
  const [{ n }] = await db.select({ n: count() }).from(s.organizations);
  if (n > 0) return false;
  await seedDemo(db);
  return true;
}

export async function seedDemo(db: DB, now = new Date()) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.transaction(async (tx) => {
    const [org] = await tx.insert(s.organizations).values({ name: DEMO_ORG, timezone: ORG_TZ, icpIndustries: ICP, icpMinEmployees: 25, icpMaxEmployees: 1000 }).returning();
    const users = await tx
      .insert(s.users)
      .values(DEMO_ACCOUNTS.map((a) => ({ email: a.email, name: a.name, passwordHash })))
      .returning();
    await tx.insert(s.memberships).values(DEMO_ACCOUNTS.map((a, i) => ({ orgId: org.id, userId: users[i].id, role: a.role, title: a.title })));
    await createDefaultStages(tx, org.id);
    const reps = users.filter((_, i) => DEMO_ACCOUNTS[i].role === "rep").map((u) => u.id);
    await generateWorkspace(tx, org.id, reps, now);
  });
}

export async function createDefaultStages(db: Executor, orgId: string) {
  return db
    .insert(s.pipelineStages)
    .values(DEFAULT_STAGES.map((st, i) => ({ orgId, name: st.name, position: i, probability: st.probability, kind: st.kind })))
    .returning();
}

/** Deletes all sales data for an org (keeps users, memberships and pipeline stages) and regenerates the demo dataset. */
export async function resetDemoData(db: DB, orgId: string, repIds: string[], now = new Date()) {
  await db.transaction(async (tx) => {
    for (const t of [s.activities, s.tasks, s.meetings, s.calls, s.deals, s.leads, s.contacts, s.companies, s.campaigns]) {
      await tx.delete(t).where(eq(t.orgId, orgId));
    }
    await tx.update(s.organizations).set({ icpIndustries: ICP, icpMinEmployees: 25, icpMaxEmployees: 1000 }).where(eq(s.organizations.id, orgId));
    await generateWorkspace(tx, orgId, repIds, now);
  });
}

// ---------- Generator ----------

interface SimLead {
  id: string;
  orgId: string;
  contactId: string;
  companyId: string;
  campaignId: string;
  ownerId: string | null;
  status: LeadStatus;
  source: string;
  score: number;
  scoreFactors: s.ScoreFactor[];
  attemptCount: number;
  connectCount: number;
  lastContactedAt: Date | null;
  lastDisposition: string | null;
  nextActionAt: Date | null;
  nextActionType: string | null;
  nextActionReason: string | null;
  unqualifiedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  timezone: string;
}

async function generateWorkspace(tx: Executor, orgId: string, repIds: string[], now: Date) {
  const rng = createRng(hashString(orgId) ^ 0x5eed);
  const stages = await tx.select().from(s.pipelineStages).where(eq(s.pipelineStages.orgId, orgId)).orderBy(s.pipelineStages.position);
  const stageByName = new Map(stages.map((st) => [st.name, st]));
  const openStages = stages.filter((st) => st.kind === "open");
  const wonStage = stages.find((st) => st.kind === "won")!;
  const lostStage = stages.find((st) => st.kind === "lost")!;
  const icp = { industries: ICP, minEmployees: 25, maxEmployees: 1000 };
  const owners = repIds.length ? repIds : [];

  // Campaigns
  const campaignDefs = [
    { key: "hvac", name: "Q4 HVAC & Plumbing Outbound", description: "Owner/ops leaders at HVAC and plumbing contractors, 25–1,000 employees, before peak season." },
    { key: "fm", name: "Facilities & Security Expansion", description: "Facilities management, electrical, pest and security companies — new verticals test." },
    { key: "inbound", name: "Inbound Demo Requests", description: "Website demo requests and referrals. Call within 5 minutes." },
    { key: "webinar", name: "Field Ops Webinar — October", description: "Registrants and attendees of 'Scaling a field team without chaos'." },
  ];
  const campaigns = campaignDefs.map((c) => ({ id: randomUUID(), orgId, name: c.name, description: c.description, active: true, createdAt: addHours(now, -24 * 50) }));
  const campaignId = Object.fromEntries(campaignDefs.map((c, i) => [c.key, campaigns[i].id]));

  // Companies & contacts
  const usedNames = new Set<string>();
  const companies: (typeof s.companies.$inferInsert & { id: string; tz: string; area: string })[] = [];
  const contacts: (typeof s.contacts.$inferInsert & { id: string; timezone: string })[] = [];
  const nCompanies = 420;
  for (let i = 0; i < nCompanies; i++) {
    const industry = weighted(rng, INDUSTRY_WEIGHTS);
    const [city, state, tz, area] = rng.pick(CITIES);
    let name = `${rng.pick(PREFIXES)} ${rng.pick(INDUSTRY_WORDS[industry])}${rng.pick(SUFFIXES)}`;
    if (usedNames.has(name)) name = `${city} ${name}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    const employees = Math.round(Math.exp(rng.range(Math.log(8), Math.log(1800))));
    const slug = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 22);
    companies.push({
      id: randomUUID(),
      orgId,
      name,
      domain: `${slug}.com`,
      industry,
      employeeCount: employees,
      annualRevenue: Math.round((employees * rng.range(90_000, 180_000)) / 100_000) * 100_000,
      city,
      state,
      country: "US",
      phone: `+1${area}555${String(rng.int(100, 199)).padStart(4, "0")}`,
      description: `${industry} contractor serving the ${city} metro area with ~${employees} employees.`,
      createdAt: addHours(now, -24 * 60),
      tz,
      area,
    });
  }
  for (const co of companies) {
    const n = co.employeeCount! > 120 ? rng.int(1, 3) : rng.chance(0.35) ? 2 : 1;
    const levels = new Set<string>();
    for (let k = 0; k < n; k++) {
      let seniority = weighted<string>(rng, co.employeeCount! < 40 ? [["c_level", 6], ["manager", 2], ["individual", 1]] : [["c_level", 2], ["vp", 2], ["director", 3], ["manager", 3], ["individual", 1]]);
      if (levels.has(seniority)) seniority = rng.pick(["manager", "director", "individual"]);
      levels.add(seniority);
      const first = rng.pick(FIRST);
      const last = rng.pick(LAST);
      const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
      contacts.push({
        id: randomUUID(),
        orgId,
        companyId: co.id,
        firstName: first,
        lastName: last,
        title: rng.pick(TITLES[seniority]),
        seniority,
        email: `${handle}@${co.domain}`,
        phone: `+1${co.area}555${String(rng.int(100, 199)).padStart(4, "0")}`,
        mobile: rng.chance(0.45) ? `+1${co.area}555${String(rng.int(100, 199)).padStart(4, "0")}` : null,
        linkedinUrl: rng.chance(0.7) ? `https://www.linkedin.com/in/${handle.replace(".", "-")}-${rng.int(100, 999)}` : null,
        timezone: co.tz,
        createdAt: addHours(now, -24 * 60),
      });
    }
  }
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  // Leads: weekly outbound list imports + a steady trickle of inbound / webinar leads.
  const shuffled = [...contacts].sort(() => rng.next() - 0.5);
  const leads: SimLead[] = [];
  let ci = 0;
  let rr = 0;
  const mkLead = (contactId: string, createdAt: Date, source: string, campaign: string, ownerId: string | null) => {
    const ct = contactsById.get(contactId)!;
    const co = companyById.get(ct.companyId!)!;
    const lead: SimLead = {
      id: randomUUID(), orgId, contactId, companyId: co.id, campaignId: campaign, ownerId, status: "new", source, score: 0, scoreFactors: [],
      attemptCount: 0, connectCount: 0, lastContactedAt: null, lastDisposition: null, nextActionAt: null, nextActionType: "call",
      nextActionReason: source === "inbound_demo" ? "New inbound demo request — call within 5 minutes" : "New lead — first touch",
      unqualifiedReason: null, createdAt, updatedAt: createdAt, timezone: ct.timezone,
    };
    const r = rescore(lead, contactView(ct), companyView(co), icp, createdAt);
    lead.score = r.score;
    lead.scoreFactors = r.factors;
    leads.push(lead);
  };
  for (const daysAgo of [31, 24, 17, 10, 3, 1]) {
    const at = addHours(now, -24 * daysAgo);
    for (let k = 0; k < 85 && ci < shuffled.length; k++, ci++) {
      const ct = shuffled[ci];
      const co = companyById.get(ct.companyId!)!;
      const camp = ["HVAC", "Plumbing"].includes(co.industry!) || rng.chance(0.3) ? campaignId.hvac : campaignId.fm;
      mkLead(ct.id, at, "outbound_list", camp, owners.length ? owners[rr++ % owners.length] : null);
    }
  }
  while (ci < shuffled.length - 4) {
    const ct = shuffled[ci++];
    const createdAt = addHours(now, -rng.range(6, 24 * 32));
    const source = weighted(rng, [["inbound_demo", 3], ["referral", 1], ["webinar", 3], ["content", 2], ["event", 1]]);
    const camp = source === "inbound_demo" || source === "referral" ? campaignId.inbound : campaignId.webinar;
    mkLead(ct.id, createdAt, source, camp, owners.length ? owners[rr++ % owners.length] : null);
  }
  // Fresh inbound leads nobody has picked up yet — the manager dashboard surfaces these for assignment.
  for (const hrs of [0.4, 1.5, 3]) {
    if (ci >= shuffled.length) break;
    mkLead(shuffled[ci++].id, addHours(now, -hrs), "inbound_demo", campaignId.inbound, null);
  }

  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const calls: (typeof s.calls.$inferInsert)[] = [];
  const activities: ActivityInsert[] = [];
  const tasks: TaskInsert[] = [];
  const meetings: MeetingInsert[] = [];
  const deals: (DealInsert & { nextMoveAt?: Date })[] = [];

  const leadsByOwner = new Map<string, SimLead[]>();
  for (const l of leads) if (l.ownerId) leadsByOwner.set(l.ownerId, [...(leadsByOwner.get(l.ownerId) ?? []), l]);
  const openDealByLead = new Map<string, DealInsert & { nextMoveAt?: Date }>();

  const completeAutoTasks = (leadId: string, at: Date) => {
    for (const t of tasks) if (t.leadId === leadId && t.auto && !t.completedAt) t.completedAt = at;
  };

  const logCall = (lead: SimLead, userId: string, at: Date) => {
    const ct = contactById.get(lead.contactId)!;
    const co = companyById.get(lead.companyId)!;
    const reachP = lead.nextActionType === "callback" ? 0.65 : lead.lastDisposition === "interested" ? 0.42 : 0.11 + (ct.mobile ? 0.08 : 0);
    let disposition: DispositionKey;
    if (rng.chance(reachP)) {
      const warm = lead.lastDisposition === "interested" || lead.lastDisposition === "callback";
      const fitBoost = lead.score >= 55 ? 2 : 0;
      disposition = warm
        ? weighted<DispositionKey>(rng, [["meeting_booked", 5 + fitBoost], ["interested", 3], ["callback", 4], ["not_interested", 6]])
        : weighted<DispositionKey>(rng, [["interested", 30], ["callback", 22], ["meeting_booked", 5 + fitBoost * 2], ["not_interested", 38], ["do_not_call", 4]]);
    } else {
      disposition = weighted<DispositionKey>(rng, [["no_answer", 58], ["voicemail", 30], ["busy", 4], ["gatekeeper", 6], ["wrong_number", 2]]);
    }
    const connected = ["interested", "callback", "meeting_booked", "not_interested", "do_not_call"].includes(disposition);
    const durationSec = connected ? (disposition === "meeting_booked" ? rng.int(300, 900) : rng.int(45, 420)) : rng.int(12, 45);
    const notesPool = NOTES[disposition];
    const notes = notesPool && (connected || rng.chance(0.5))
      ? fill(rng.pick(notesPool), { first: ct.firstName, city: co.city!, ind: co.industry!, n: Math.max(4, Math.round(co.employeeCount! * 0.35)) })
      : null;
    const callbackAt = disposition === "callback" ? nextCallingTime(addHours(addBusinessDays(at, rng.int(1, 2), ct.timezone), rng.int(0, 4)), ct.timezone) : null;
    const meetingAt = disposition === "meeting_booked" ? nextCallingTime(addHours(addBusinessDays(at, rng.int(2, 6), ct.timezone), rng.int(0, 3)), ct.timezone) : null;

    const callId = randomUUID();
    const out = buildCallOutcome(
      {
        now: at, orgId, userId, lead, contact: contactView(ct), contactId: ct.id, company: { ...companyView(co), name: co.name },
        icp, meetingStageId: stageByName.get("Meeting Booked")!.id, hasOpenDeal: openDealByLead.has(lead.id),
      },
      { disposition, callbackAt, meetingAt, reason: disposition === "not_interested" ? rng.pick(["No need", "Using a competitor", "No budget", "Bad timing", "Too small"]) : null, notes, durationSec, callId },
    );
    calls.push({
      id: callId, orgId, leadId: lead.id, userId, provider: "demo", providerCallId: `demo_${callId.slice(0, 8)}`, toNumber: ct.mobile ?? ct.phone!,
      status: "completed", startedAt: at, answeredAt: connected ? new Date(at.getTime() + 9000) : null, endedAt: new Date(at.getTime() + durationSec * 1000),
      durationSec, disposition, notes,
    });
    completeAutoTasks(lead.id, at);
    Object.assign(lead, out.leadPatch);
    if (out.contactPatch.doNotCall) ct.doNotCall = true;
    if (out.contactPatch.phoneInvalid) ct.phoneInvalid = true;
    activities.push(...out.activities);
    if (out.task) tasks.push(out.task);
    if (out.meeting) meetings.push(out.meeting);
    if (out.deal) {
      deals.push(out.deal);
      openDealByLead.set(lead.id, out.deal);
    }
    return durationSec;
  };

  const moveDeal = (deal: DealInsert & { nextMoveAt?: Date }, stage: typeof stages[number], at: Date, lostReason?: string) => {
    const from = stages.find((x) => x.id === deal.stageId)!;
    const lead = leads.find((l) => l.id === deal.leadId)!;
    const ct = contactById.get(deal.contactId!)!;
    const co = companyById.get(deal.companyId!)!;
    deal.stageId = stage.id;
    deal.stageChangedAt = at;
    deal.updatedAt = at;
    deal.nextStep = STAGE_NEXT_STEPS[stage.name] ?? null;
    for (const t of tasks) if (t.dealId === deal.id && !t.completedAt) t.completedAt = at;
    activities.push({
      id: randomUUID(), orgId, leadId: deal.leadId, companyId: deal.companyId, dealId: deal.id, userId: deal.ownerId, type: "stage_change",
      title: `Deal moved to ${stage.name}`, body: lostReason ? `Lost reason: ${lostReason}` : null,
      meta: { stageFrom: from.name, stageTo: stage.name, value: deal.value }, occurredAt: at,
    });
    if (stage.kind !== "open") {
      deal.closedAt = at;
      deal.nextMoveAt = undefined;
      openDealByLead.delete(lead.id);
      if (stage.kind === "lost") deal.lostReason = lostReason ?? null;
      if (stage.kind === "won") {
        activities.push({ id: randomUUID(), orgId, leadId: lead.id, companyId: lead.companyId, userId: deal.ownerId, type: "status_change", title: "Lead converted to customer", body: null, meta: { statusFrom: lead.status, statusTo: "converted" }, occurredAt: at });
        lead.status = "converted";
        lead.updatedAt = at;
      }
    } else {
      deal.nextMoveAt = addHours(at, 24 * rng.range(3, 9));
      const tt = STAGE_TASKS[stage.name];
      if (tt) {
        tasks.push({
          id: randomUUID(), orgId, leadId: deal.leadId, dealId: deal.id, assigneeId: deal.ownerId, createdById: deal.ownerId, type: tt.type,
          title: fill(tt.title, { first: ct.firstName, company: co.name }), dueAt: addBusinessDays(at, 2, ORG_TZ), auto: false, createdAt: at,
        });
      }
    }
  };

  const advanceDeals = (until: Date) => {
    for (const m of meetings) {
      if (m.status !== "scheduled" || m.scheduledAt > until) continue;
      const deal = deals.find((d) => d.id === m.dealId);
      const held = rng.chance(0.86);
      m.status = held ? "held" : "no_show";
      activities.push({
        id: randomUUID(), orgId, leadId: m.leadId, companyId: deal?.companyId ?? null, dealId: m.dealId, userId: m.userId, type: "meeting",
        title: held ? `Meeting held · ${m.title}` : `No-show · ${m.title}`, body: null, meta: { meetingId: m.id }, occurredAt: addHours(m.scheduledAt, 0.5),
      });
      if (deal && !deal.closedAt) {
        if (held) moveDeal(deal, stageByName.get("Discovery")!, addHours(m.scheduledAt, 0.6));
        else moveDeal(deal, lostStage, addHours(m.scheduledAt, 24), "No-show, then went dark");
      }
    }
    for (const d of deals) {
      if (d.closedAt || !d.nextMoveAt || d.nextMoveAt > until) continue;
      const idx = openStages.findIndex((x) => x.id === d.stageId);
      if (idx < 1) continue; // Meeting Booked waits for the meeting
      const p = [0, 0.78, 0.72, 0.7, 0.62][idx] ?? 0.6;
      if (!rng.chance(p)) moveDeal(d, lostStage, d.nextMoveAt, rng.pick(LOST_REASONS));
      else moveDeal(d, idx + 1 < openStages.length ? openStages[idx + 1] : wonStage, d.nextMoveAt);
    }
  };

  // Simulate each business day for each rep, ET working hours, up to "now".
  const repRate = new Map(owners.map((id, i) => [id, [1.0, 0.85, 1.1, 0.95][i % 4]]));
  for (let daysAgo = 32; daysAgo >= 0; daysAgo--) {
    const dayRef = addHours(now, -24 * daysAgo);
    const lp = localParts(dayRef, ORG_TZ);
    if (lp.isWeekend) continue;
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TZ }).format(dayRef).split("-").map(Number);
    for (const rep of owners) {
      let t = zonedDate(ymd[0], ymd[1], ymd[2], 9, rng.int(0, 25), ORG_TZ);
      const end = new Date(Math.min(zonedDate(ymd[0], ymd[1], ymd[2], 17, 30, ORG_TZ).getTime(), now.getTime() - 10 * 60_000));
      const lunch = zonedDate(ymd[0], ymd[1], ymd[2], 12, 0, ORG_TZ);
      while (t < end) {
        if (t >= lunch && t < addHours(lunch, 1)) {
          t = addHours(lunch, 1);
          continue;
        }
        const mine = (leadsByOwner.get(rep) ?? []).filter((l) => {
          const ct = contactById.get(l.contactId)!;
          return l.createdAt <= t && !ct.doNotCall && !ct.phoneInvalid && l.status !== "unqualified" && l.status !== "converted";
        });
        const next = rankQueue(mine, t).find((r) => r.callableNow);
        if (!next) {
          t = addHours(t, 0.5);
          continue;
        }
        const dur = logCall(next.lead, rep, t);
        t = new Date(t.getTime() + (dur + rng.int(200, 480) / repRate.get(rep)!) * 1000);
      }
    }
    advanceDeals(new Date(Math.min(addHours(dayRef, 12).getTime(), now.getTime())));
  }
  advanceDeals(now);

  // A few manual notes so timelines contain more than calls.
  for (const l of leads.filter((x) => x.connectCount > 0 && x.ownerId).slice(0, 25)) {
    const at = addHours(l.lastContactedAt!, 0.2);
    if (at > now) continue;
    const co = companyById.get(l.companyId)!;
    activities.push({
      id: randomUUID(), orgId, leadId: l.id, companyId: l.companyId, userId: l.ownerId, type: "note", title: "Note",
      body: rng.pick([
        `Checked their site — ${co.city} HQ, hiring 2 more techs. Good timing.`,
        `${co.name} reviews mention late arrivals; lead with on-time arrival metrics.`,
        "Decision is owner + office manager. Office manager handles all dispatch today.",
        "Peak season starts in ~6 weeks; they want something live before then.",
      ]),
      meta: {}, occurredAt: at,
    });
  }
  for (const l of leads) {
    if (l.ownerId) {
      activities.push({
        id: randomUUID(), orgId, leadId: l.id, companyId: l.companyId, userId: null, type: "created", title: "Lead created",
        body: null, meta: { source: l.source }, occurredAt: l.createdAt,
      });
    } else {
      activities.push({ id: randomUUID(), orgId, leadId: l.id, companyId: l.companyId, userId: null, type: "created", title: "Lead created · unassigned", body: null, meta: { source: l.source }, occurredAt: l.createdAt });
    }
  }
  // Final rescore at "now" so freshness factors are current.
  for (const l of leads) {
    const ct = contactById.get(l.contactId)!;
    const r = rescore(l, contactView(ct), companyView(companyById.get(l.companyId)!), icp, now);
    l.score = r.score;
    l.scoreFactors = r.factors;
  }

  await insertChunked(tx, s.campaigns, campaigns);
  await insertChunked(tx, s.companies, companies.map(({ tz: _tz, area: _area, ...c }) => c));
  await insertChunked(tx, s.contacts, contacts);
  await insertChunked(tx, s.leads, leads.map(({ timezone: _tz, ...l }) => l));
  await insertChunked(tx, s.calls, calls);
  await insertChunked(tx, s.deals, deals.map(({ nextMoveAt: _n, ...d }) => d));
  await insertChunked(tx, s.meetings, meetings);
  await insertChunked(tx, s.tasks, tasks);
  await insertChunked(tx, s.activities, activities, 400);
  return { leads: leads.length, calls: calls.length, deals: deals.length };
}

function contactView(c: typeof s.contacts.$inferInsert) {
  return {
    firstName: c.firstName, lastName: c.lastName, timezone: c.timezone!, seniority: c.seniority ?? null, phone: c.phone ?? null,
    mobile: c.mobile ?? null, phoneInvalid: !!c.phoneInvalid, doNotCall: !!c.doNotCall,
  };
}

function companyView(c: typeof s.companies.$inferInsert) {
  return { industry: c.industry ?? null, employeeCount: c.employeeCount ?? null, annualRevenue: c.annualRevenue ?? null };
}

