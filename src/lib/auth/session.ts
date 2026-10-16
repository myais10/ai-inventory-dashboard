import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_MS, signToken, verifyToken } from "./token";

export type Role = "owner" | "manager" | "rep";

export interface Session {
  user: { id: string; email: string; name: string; firstName: string };
  org: { id: string; name: string; timezone: string; icpIndustries: string[]; icpMinEmployees: number; icpMaxEmployees: number };
  role: Role;
  title: string | null;
}

export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const tok = await verifyToken(store.get(SESSION_COOKIE)?.value);
  if (!tok) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: schema.users, org: schema.organizations, role: schema.memberships.role, title: schema.memberships.title })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.memberships.orgId))
    .where(and(eq(schema.memberships.userId, tok.uid), eq(schema.memberships.orgId, tok.oid)))
    .limit(1);
  if (!row) return null;
  return {
    user: { id: row.user.id, email: row.user.email, name: row.user.name, firstName: row.user.name.split(" ")[0] },
    org: {
      id: row.org.id,
      name: row.org.name,
      timezone: row.org.timezone,
      icpIndustries: row.org.icpIndustries,
      icpMinEmployees: row.org.icpMinEmployees,
      icpMaxEmployees: row.org.icpMaxEmployees,
    },
    role: row.role,
    title: row.title,
  };
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export function isManager(s: Pick<Session, "role">) {
  return s.role === "owner" || s.role === "manager";
}

export async function requireManager(): Promise<Session> {
  const s = await requireSession();
  if (!isManager(s)) redirect("/desk");
  return s;
}

export async function startSession(uid: string, oid: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signToken({ uid, oid, iat: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
