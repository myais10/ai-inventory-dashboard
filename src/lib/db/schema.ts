// Phoonica relational schema. Every business table carries org_id; all queries are org-scoped
// in the service layer (src/lib/services). Postgres-native so it runs on embedded PGlite in dev
// and on Supabase / any Postgres in production with the same migrations.

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const orgId = () => uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------- Tenancy & users ----------

export const roleEnum = pgEnum("role", ["owner", "manager", "rep"]);

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  // Ideal customer profile used by lead scoring.
  icpIndustries: text("icp_industries").array().notNull().default(sql`'{}'::text[]`),
  icpMinEmployees: integer("icp_min_employees").notNull().default(50),
  icpMaxEmployees: integer("icp_max_employees").notNull().default(5000),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: orgId(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("rep"),
    title: text("title"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

// ---------- Accounts & people ----------

export const companies = pgTable(
  "companies",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    employeeCount: integer("employee_count"),
    annualRevenue: integer("annual_revenue"), // USD
    city: text("city"),
    state: text("state"),
    country: text("country").default("US"),
    phone: text("phone"),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("companies_org_idx").on(t.orgId), index("companies_org_name_idx").on(t.orgId, t.name)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    orgId: orgId(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    title: text("title"),
    seniority: text("seniority"), // c_level | vp | director | manager | individual
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    linkedinUrl: text("linkedin_url"),
    timezone: text("timezone").notNull().default("America/New_York"),
    doNotCall: boolean("do_not_call").notNull().default(false),
    phoneInvalid: boolean("phone_invalid").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("contacts_org_idx").on(t.orgId), index("contacts_company_idx").on(t.companyId)],
);

// ---------- Campaigns & leads ----------

export const campaigns = pgTable("campaigns", {
  id: id(),
  orgId: orgId(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "attempting",
  "connected",
  "qualified",
  "nurture",
  "unqualified",
  "converted",
]);

export const leads = pgTable(
  "leads",
  {
    id: id(),
    orgId: orgId(),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    status: leadStatusEnum("status").notNull().default("new"),
    source: text("source").notNull().default("outbound_list"),
    score: integer("score").notNull().default(0),
    scoreFactors: jsonb("score_factors").$type<ScoreFactor[]>().notNull().default([]),
    attemptCount: integer("attempt_count").notNull().default(0),
    connectCount: integer("connect_count").notNull().default(0),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    lastDisposition: text("last_disposition"),
    // The system-determined next action. The Next Best Lead queue is driven by these.
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    nextActionType: text("next_action_type"), // call | callback | email | none
    nextActionReason: text("next_action_reason"),
    unqualifiedReason: text("unqualified_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("leads_org_idx").on(t.orgId),
    index("leads_org_owner_idx").on(t.orgId, t.ownerId),
    index("leads_org_status_idx").on(t.orgId, t.status),
    index("leads_next_action_idx").on(t.orgId, t.nextActionAt),
    uniqueIndex("leads_contact_unique").on(t.contactId),
  ],
);

export interface ScoreFactor {
  key: string;
  label: string;
  points: number;
}

// ---------- Calls & activity ----------

export const calls = pgTable(
  "calls",
  {
    id: id(),
    orgId: orgId(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    providerCallId: text("provider_call_id"),
    toNumber: text("to_number").notNull(),
    status: text("status").notNull().default("initiated"), // initiated | ringing | in_progress | completed | failed
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSec: integer("duration_sec"),
    disposition: text("disposition"),
    notes: text("notes"),
    recordingUrl: text("recording_url"),
  },
  (t) => [index("calls_org_user_idx").on(t.orgId, t.userId, t.startedAt), index("calls_lead_idx").on(t.leadId)],
);

export const activities = pgTable(
  "activities",
  {
    id: id(),
    orgId: orgId(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
    // call | note | email | status_change | stage_change | meeting_booked | task_completed | assignment | deal_created
    type: text("type").notNull(),
    disposition: text("disposition"),
    title: text("title").notNull(),
    body: text("body"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activities_lead_idx").on(t.leadId, t.occurredAt),
    index("activities_company_idx").on(t.companyId, t.occurredAt),
    index("activities_org_time_idx").on(t.orgId, t.occurredAt),
  ],
);

// ---------- Tasks & meetings ----------

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    orgId: orgId(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull().default("follow_up"), // call | callback | email | follow_up | meeting_prep | other
    title: text("title").notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Tasks created by the disposition engine are "auto" so they can be closed automatically when superseded.
    auto: boolean("auto").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_assignee_idx").on(t.orgId, t.assigneeId, t.completedAt, t.dueAt), index("tasks_lead_idx").on(t.leadId)],
);

export const meetings = pgTable(
  "meetings",
  {
    id: id(),
    orgId: orgId(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    status: text("status").notNull().default("scheduled"), // scheduled | held | no_show | cancelled
    calendarProvider: text("calendar_provider"),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [index("meetings_org_time_idx").on(t.orgId, t.scheduledAt)],
);

// ---------- Pipeline & deals ----------

export const stageKindEnum = pgEnum("stage_kind", ["open", "won", "lost"]);

export const pipelineStages = pgTable("pipeline_stages", {
  id: id(),
  orgId: orgId(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  probability: integer("probability").notNull(), // 0-100
  kind: stageKindEnum("kind").notNull().default("open"),
});

export const deals = pgTable(
  "deals",
  {
    id: id(),
    orgId: orgId(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    stageId: uuid("stage_id").notNull().references(() => pipelineStages.id),
    name: text("name").notNull(),
    value: integer("value").notNull().default(0), // USD annual contract value
    expectedCloseDate: text("expected_close_date"), // ISO day
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lostReason: text("lost_reason"),
    nextStep: text("next_step"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("deals_org_stage_idx").on(t.orgId, t.stageId), index("deals_lead_idx").on(t.leadId)],
);
