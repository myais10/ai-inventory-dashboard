import "server-only";
import { and, count, eq, isNull, lte, ne, notInArray, or } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { zonedDate } from "@/lib/domain/time";
import type { Ctx } from "./context";

export function endOfToday(tz: string, now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now).split("-").map(Number);
  return zonedDate(y, m, d, 23, 59, tz);
}

export async function getBadges(ctx: Ctx, tz: string) {
  const db = await getDb();
  const now = new Date();
  const [[queue], [tasks], [unassigned]] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .where(
        and(
          eq(s.leads.orgId, ctx.orgId),
          eq(s.leads.ownerId, ctx.userId),
          ne(s.leads.nextActionType, "none"),
          or(isNull(s.leads.nextActionAt), lte(s.leads.nextActionAt, now)),
          notInArray(s.leads.status, ["unqualified", "converted"]),
          eq(s.contacts.doNotCall, false),
          eq(s.contacts.phoneInvalid, false),
        ),
      ),
    db
      .select({ n: count() })
      .from(s.tasks)
      .where(and(eq(s.tasks.orgId, ctx.orgId), eq(s.tasks.assigneeId, ctx.userId), isNull(s.tasks.completedAt), lte(s.tasks.dueAt, endOfToday(tz, now)))),
    db
      .select({ n: count() })
      .from(s.leads)
      .where(and(eq(s.leads.orgId, ctx.orgId), isNull(s.leads.ownerId), notInArray(s.leads.status, ["unqualified", "converted"]))),
  ]);
  return { queue: queue.n, tasks: tasks.n, unassigned: unassigned.n };
}
