"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { createDefaultStages, resetDemoData } from "@/lib/db/seed";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "@/lib/auth/session";

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const email = z.string().trim().toLowerCase().email("Enter a valid work email");

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password"), next: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return { error: "Incorrect email or password." };
  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, user.id)).limit(1);
  if (!m) return { error: "Your account isn't a member of any workspace." };
  await startSession(user.id, m.orgId);
  redirect(safeNext(parsed.data.next));
}

export async function signupAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your full name").max(80),
      orgName: z.string().trim().min(2, "Enter your company name").max(120),
      email,
      password: z.string().min(8, "Use at least 8 characters").max(128),
      demo: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const db = await getDb();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, d.email)).limit(1);
  if (existing) return { fieldErrors: { email: "An account with this email already exists — sign in instead." } };

  const passwordHash = await hashPassword(d.password);
  const { userId, orgId } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(schema.organizations).values({ name: d.orgName }).returning();
    const [user] = await tx.insert(schema.users).values({ email: d.email, name: d.name, passwordHash }).returning();
    await tx.insert(schema.memberships).values({ orgId: org.id, userId: user.id, role: "owner" });
    await createDefaultStages(tx, org.id);
    return { userId: user.id, orgId: org.id };
  });
  if (d.demo === "on") await resetDemoData(db, orgId, [userId]);
  await startSession(userId, orgId);
  redirect("/");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}
