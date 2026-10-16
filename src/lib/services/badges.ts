import "server-only";
import { and, count, eq, isNull, lte, notInArray } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { zonedDate } from "@/lib/domain/time";
import type { Ctx } from "./context";
import { getQueue } from "./desk";

export function endOfToday(tz: string, now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now).split("-").map(Number);
  return zonedDate(y, m, d, 23, 59, tz);
}

export async function getBadges(ctx: Ctx, tz: string) {
  const db = await getDb();
  const now = new Date();
  const [queue, [tasks], [unassigned]] = await Promise.all([
    // Same definition as the Calling Desk so the badge and the queue always agree.
    getQueue(ctx),
    db
      .select({ n: count() })
      .from(s.tasks)
      .where(and(eq(s.tasks.orgId, ctx.orgId), eq(s.tasks.assigneeId, ctx.userId), isNull(s.tasks.completedAt), lte(s.tasks.dueAt, endOfToday(tz, now)))),
    db
      .select({ n: count() })
      .from(s.leads)
      .where(and(eq(s.leads.orgId, ctx.orgId), isNull(s.leads.ownerId), notInArray(s.leads.status, ["unqualified", "converted"]))),
  ]);
  return { queue: queue.due.length, tasks: tasks.n, unassigned: unassigned.n };
}
