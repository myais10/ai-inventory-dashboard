import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { rescore } from "@/lib/domain/outcome";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { resetDemoData } from "@/lib/db/seed";
import type { Role } from "@/lib/auth/session";
import { isManagerRole, type Ctx } from "./context";
import { UserError } from "./errors";

function requireOwner(ctx: Ctx) {
  if (ctx.role !== "owner") throw new UserError("Only the workspace owner can do this");
}

/** Updates workspace settings. Changing the ICP rescores every lead so rankings stay truthful. */
export async function updateWorkspace(ctx: Ctx, input: { name: string; timezone: string; icpIndustries: string[]; icpMinEmployees: number; icpMaxEmployees: number }) {
  if (!isManagerRole(ctx.role)) throw new UserError("Only managers can change workspace settings");
  if (input.icpMinEmployees > input.icpMaxEmployees) throw new UserError("Minimum employees must be below maximum");
  const db = await getDb();
  const [org] = await db.select().from(s.organizations).where(eq(s.organizations.id, ctx.orgId));
  const icpChanged =
    org.icpIndustries.join("|") !== input.icpIndustries.join("|") || org.icpMinEmployees !== input.icpMinEmployees || org.icpMaxEmployees !== input.icpMaxEmployees;
  await db.update(s.organizations).set(input).where(eq(s.organizations.id, ctx.orgId));
  if (!icpChanged) return 0;
  const rows = await db
    .select({ lead: s.leads, contact: s.contacts, company: s.companies })
    .from(s.leads)
    .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.leads.companyId))
    .where(eq(s.leads.orgId, ctx.orgId));
  const icp = { industries: input.icpIndustries, minEmployees: input.icpMinEmployees, maxEmployees: input.icpMaxEmployees };
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const { score, factors } = rescore(r.lead, r.contact, r.company, icp, now);
      if (score !== r.lead.score) await tx.update(s.leads).set({ score, scoreFactors: factors }).where(eq(s.leads.id, r.lead.id));
    }
  });
  return rows.length;
}

export async function addMember(ctx: Ctx, input: { name: string; email: string; role: Role; title: string | null; password: string }) {
  requireOwner(ctx);
  const db = await getDb();
  const [existing] = await db.select().from(s.users).where(eq(s.users.email, input.email));
  return db.transaction(async (tx) => {
    let userId = existing?.id;
    if (existing) {
      const [m] = await tx.select().from(s.memberships).where(and(eq(s.memberships.orgId, ctx.orgId), eq(s.memberships.userId, existing.id)));
      if (m) throw new UserError("That person is already in this workspace");
    } else {
      const [u] = await tx.insert(s.users).values({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) }).returning();
      userId = u.id;
    }
    await tx.insert(s.memberships).values({ orgId: ctx.orgId, userId: userId!, role: input.role, title: input.title });
    return { existing: !!existing };
  });
}

export async function updateMember(ctx: Ctx, userId: string, patch: { role?: Role; title?: string | null }) {
  requireOwner(ctx);
  if (userId === ctx.userId && patch.role && patch.role !== "owner") throw new UserError("You can't demote yourself — make someone else owner first");
  const db = await getDb();
  await db.update(s.memberships).set(patch).where(and(eq(s.memberships.orgId, ctx.orgId), eq(s.memberships.userId, userId)));
}

/** Removes a member; their open leads and tasks go back to the unassigned pool rather than disappearing. */
export async function removeMember(ctx: Ctx, userId: string) {
  requireOwner(ctx);
  if (userId === ctx.userId) throw new UserError("You can't remove yourself");
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(s.leads).set({ ownerId: null }).where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.ownerId, userId)));
    await tx.update(s.tasks).set({ assigneeId: null }).where(and(eq(s.tasks.orgId, ctx.orgId), eq(s.tasks.assigneeId, userId)));
    await tx.delete(s.memberships).where(and(eq(s.memberships.orgId, ctx.orgId), eq(s.memberships.userId, userId)));
  });
}

export async function updateProfile(ctx: Ctx, input: { name: string; currentPassword?: string; newPassword?: string }) {
  const db = await getDb();
  const [u] = await db.select().from(s.users).where(eq(s.users.id, ctx.userId));
  const patch: { name: string; passwordHash?: string } = { name: input.name };
  if (input.newPassword) {
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, u.passwordHash))) throw new UserError("Current password is incorrect");
    patch.passwordHash = await hashPassword(input.newPassword);
  }
  await db.update(s.users).set(patch).where(eq(s.users.id, ctx.userId));
}

export async function resetWorkspaceDemoData(ctx: Ctx) {
  requireOwner(ctx);
  const db = await getDb();
  const reps = await db.select({ id: s.memberships.userId }).from(s.memberships).where(and(eq(s.memberships.orgId, ctx.orgId), eq(s.memberships.role, "rep")));
  await resetDemoData(db, ctx.orgId, reps.length ? reps.map((r) => r.id) : [ctx.userId]);
}

export async function clearWorkspaceData(ctx: Ctx) {
  requireOwner(ctx);
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const t of [s.activities, s.tasks, s.meetings, s.calls, s.deals, s.leads, s.contacts, s.companies, s.campaigns]) {
      await tx.delete(t).where(eq(t.orgId, ctx.orgId));
    }
  });
}

export async function workspaceCounts(ctx: Ctx) {
  const db = await getDb();
  const [[l], [c]] = await Promise.all([
    db.select({ n: count() }).from(s.leads).where(eq(s.leads.orgId, ctx.orgId)),
    db.select({ n: count() }).from(s.calls).where(eq(s.calls.orgId, ctx.orgId)),
  ]);
  return { leads: l.n, calls: c.n };
}
