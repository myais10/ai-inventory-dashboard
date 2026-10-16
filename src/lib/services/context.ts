import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import type { Role, Session } from "@/lib/auth/session";

/** The tenant + actor every service call is scoped to. */
export interface Ctx {
  orgId: string;
  userId: string;
  role: Role;
}

export function ctxOf(session: Session): Ctx {
  return { orgId: session.org.id, userId: session.user.id, role: session.role };
}

export function isManagerRole(role: Role) {
  return role === "owner" || role === "manager";
}

/** Reps work their own leads and can claim unassigned ones; managers can work any lead. */
export function canWorkLead(ctx: Ctx, ownerId: string | null) {
  return isManagerRole(ctx.role) || ownerId === null || ownerId === ctx.userId;
}

export async function listMembers(ctx: Ctx) {
  const db = await getDb();
  return db
    .select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.memberships.role, title: s.memberships.title })
    .from(s.memberships)
    .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
    .where(eq(s.memberships.orgId, ctx.orgId))
    .orderBy(asc(s.users.name));
}

export type Member = Awaited<ReturnType<typeof listMembers>>[number];

export async function listCampaigns(ctx: Ctx) {
  const db = await getDb();
  return db.select().from(s.campaigns).where(eq(s.campaigns.orgId, ctx.orgId)).orderBy(asc(s.campaigns.name));
}
