import "server-only";
import { and, asc, count, eq, gte, isNull, lt, lte, ne, notInArray } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { endOfToday } from "./badges";
import { isManagerRole, type Ctx } from "./context";

export interface Notice {
  id: string;
  tone: "red" | "amber" | "brand" | "blue";
  title: string;
  body: string;
  href: string;
}

/** Everything that needs the user's attention right now, derived from live data (nothing stored). */
export async function getNotices(ctx: Ctx, tz: string): Promise<Notice[]> {
  const db = await getDb();
  const now = new Date();
  const eod = endOfToday(tz, now);
  const [[callbacks], [overdue], meetings, [unassigned]] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.leads)
      .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.ownerId, ctx.userId), eq(s.leads.nextActionType, "callback"), lte(s.leads.nextActionAt, now))),
    db
      .select({ n: count() })
      .from(s.tasks)
      .where(and(eq(s.tasks.orgId, ctx.orgId), eq(s.tasks.assigneeId, ctx.userId), isNull(s.tasks.completedAt), lt(s.tasks.dueAt, now))),
    db
      .select({ id: s.meetings.id, title: s.meetings.title, at: s.meetings.scheduledAt, dealId: s.meetings.dealId })
      .from(s.meetings)
      .where(and(eq(s.meetings.orgId, ctx.orgId), eq(s.meetings.userId, ctx.userId), eq(s.meetings.status, "scheduled"), gte(s.meetings.scheduledAt, now), lte(s.meetings.scheduledAt, eod)))
      .orderBy(asc(s.meetings.scheduledAt))
      .limit(3),
    isManagerRole(ctx.role)
      ? db
          .select({ n: count() })
          .from(s.leads)
          .where(and(eq(s.leads.orgId, ctx.orgId), isNull(s.leads.ownerId), notInArray(s.leads.status, ["unqualified", "converted"]), ne(s.leads.nextActionType, "none")))
      : Promise.resolve([{ n: 0 }]),
  ]);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const out: Notice[] = [];
  if (callbacks.n) out.push({ id: "callbacks", tone: "red", title: `${callbacks.n} promised callback${callbacks.n > 1 ? "s" : ""} due`, body: "They're at the top of your Calling Desk queue.", href: "/desk" });
  if (overdue.n) out.push({ id: "overdue", tone: "amber", title: `${overdue.n} overdue task${overdue.n > 1 ? "s" : ""}`, body: "Clear or reschedule them.", href: "/tasks?bucket=overdue" });
  for (const m of meetings) out.push({ id: `m-${m.id}`, tone: "brand", title: `Meeting at ${fmt.format(m.at)}`, body: m.title, href: m.dealId ? `/pipeline/${m.dealId}` : "/pipeline" });
  if (unassigned.n) out.push({ id: "unassigned", tone: "blue", title: `${unassigned.n} unassigned lead${unassigned.n > 1 ? "s" : ""}`, body: "Assign them from the Sales Floor.", href: "/sales-floor" });
  return out;
}
