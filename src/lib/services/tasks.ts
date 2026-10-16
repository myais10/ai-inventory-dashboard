import "server-only";
import { and, asc, eq, gt, isNotNull, isNull, lte, desc, sql, type SQL } from "drizzle-orm";
import { UserError } from "./errors";
import { getDb, schema as s } from "@/lib/db";
import { endOfToday } from "./badges";
import { canWorkLead, isManagerRole, type Ctx } from "./context";

export type TaskBucket = "overdue" | "today" | "upcoming" | "done";

export async function listTasks(ctx: Ctx, opts: { bucket: TaskBucket; assignee: string; tz: string }) {
  const db = await getDb();
  const now = new Date();
  const eod = endOfToday(opts.tz, now);
  const w: (SQL | undefined)[] = [eq(s.tasks.orgId, ctx.orgId)];
  if (opts.assignee !== "all") w.push(eq(s.tasks.assigneeId, opts.assignee === "me" ? ctx.userId : opts.assignee));
  if (opts.bucket === "done") w.push(isNotNull(s.tasks.completedAt));
  else w.push(isNull(s.tasks.completedAt));
  if (opts.bucket === "overdue") w.push(lte(s.tasks.dueAt, now));
  if (opts.bucket === "today") w.push(gt(s.tasks.dueAt, now), lte(s.tasks.dueAt, eod));
  if (opts.bucket === "upcoming") w.push(gt(s.tasks.dueAt, eod));
  return db
    .select({
      task: s.tasks,
      assignee: s.users.name,
      leadFirst: s.contacts.firstName,
      leadLast: s.contacts.lastName,
      companyName: s.companies.name,
      leadStatus: s.leads.status,
      dealName: s.deals.name,
    })
    .from(s.tasks)
    .leftJoin(s.users, eq(s.users.id, s.tasks.assigneeId))
    .leftJoin(s.leads, eq(s.leads.id, s.tasks.leadId))
    .leftJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
    .leftJoin(s.deals, eq(s.deals.id, s.tasks.dealId))
    .where(and(...w))
    .orderBy(opts.bucket === "done" ? desc(s.tasks.completedAt) : asc(s.tasks.dueAt))
    .limit(200);
}

export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export async function taskCounts(ctx: Ctx, assignee: string, tz: string) {
  const db = await getDb();
  const now = new Date();
  const eod = endOfToday(tz, now);
  const [r] = await db
    .select({
      overdue: sql<number>`count(*) filter (where ${s.tasks.dueAt} <= ${now})::int`,
      today: sql<number>`count(*) filter (where ${s.tasks.dueAt} > ${now} and ${s.tasks.dueAt} <= ${eod})::int`,
      upcoming: sql<number>`count(*) filter (where ${s.tasks.dueAt} > ${eod})::int`,
    })
    .from(s.tasks)
    .where(and(eq(s.tasks.orgId, ctx.orgId), isNull(s.tasks.completedAt), assignee === "all" ? undefined : eq(s.tasks.assigneeId, assignee === "me" ? ctx.userId : assignee)));
  return r;
}

async function loadTask(ctx: Ctx, taskId: string) {
  const db = await getDb();
  const [t] = await db
    .select({ task: s.tasks, leadOwner: s.leads.ownerId, companyId: s.leads.companyId })
    .from(s.tasks)
    .leftJoin(s.leads, eq(s.leads.id, s.tasks.leadId))
    .where(and(eq(s.tasks.orgId, ctx.orgId), eq(s.tasks.id, taskId)));
  if (!t) throw new UserError("Task not found");
  if (!isManagerRole(ctx.role) && t.task.assigneeId !== ctx.userId && !canWorkLead(ctx, t.leadOwner)) throw new UserError("This task belongs to someone else");
  return t;
}

export async function completeTask(ctx: Ctx, taskId: string) {
  const db = await getDb();
  const t = await loadTask(ctx, taskId);
  if (t.task.completedAt) return;
  await db.transaction(async (tx) => {
    await tx.update(s.tasks).set({ completedAt: new Date() }).where(eq(s.tasks.id, taskId));
    if (t.task.leadId || t.task.dealId) {
      await tx.insert(s.activities).values({
        orgId: ctx.orgId,
        leadId: t.task.leadId,
        dealId: t.task.dealId,
        companyId: t.companyId,
        userId: ctx.userId,
        type: "task_completed",
        title: `Task completed · ${t.task.title}`,
      });
    }
  });
}

export async function reopenTask(ctx: Ctx, taskId: string) {
  const db = await getDb();
  await loadTask(ctx, taskId);
  await db.update(s.tasks).set({ completedAt: null }).where(eq(s.tasks.id, taskId));
}

export async function rescheduleTask(ctx: Ctx, taskId: string, dueAt: Date) {
  const db = await getDb();
  const t = await loadTask(ctx, taskId);
  await db.transaction(async (tx) => {
    await tx.update(s.tasks).set({ dueAt }).where(eq(s.tasks.id, taskId));
    // A rescheduled callback/follow-up moves the lead's queue slot with it.
    if (t.task.leadId && t.task.auto && (t.task.type === "callback" || t.task.type === "follow_up")) {
      await tx.update(s.leads).set({ nextActionAt: dueAt, updatedAt: new Date() }).where(and(eq(s.leads.id, t.task.leadId), eq(s.leads.orgId, ctx.orgId)));
    }
  });
}

export async function createTask(ctx: Ctx, input: { leadId?: string | null; dealId?: string | null; assigneeId?: string | null; title: string; type: string; dueAt: Date; notes?: string | null }) {
  const db = await getDb();
  if (input.leadId) {
    const [l] = await db.select({ id: s.leads.id }).from(s.leads).where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, input.leadId)));
    if (!l) throw new UserError("Lead not found");
  }
  if (input.dealId) {
    const [d] = await db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.orgId, ctx.orgId), eq(s.deals.id, input.dealId)));
    if (!d) throw new UserError("Deal not found");
  }
  const assigneeId = input.assigneeId && isManagerRole(ctx.role) ? input.assigneeId : ctx.userId;
  const [t] = await db
    .insert(s.tasks)
    .values({ orgId: ctx.orgId, leadId: input.leadId ?? null, dealId: input.dealId ?? null, assigneeId, createdById: ctx.userId, title: input.title, type: input.type, dueAt: input.dueAt, notes: input.notes ?? null })
    .returning();
  return t;
}
