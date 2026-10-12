"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearDemoSession, writeDemoSession } from "@/lib/auth/session";
import { addDays, hashString, todayISO } from "@/lib/utils";

export interface AuthState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const email = z.string().trim().toLowerCase().email("Enter a valid work email");
const password = z.string().min(8, "Password must be at least 8 characters").max(128);

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password"), next: z.string().optional() });
const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  companyName: z.string().trim().min(2, "Enter your company name").max(120),
  email,
  password,
});

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

function nameFromEmail(e: string) {
  return e
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { email: e, password: pw, next } = parsed.data;

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: pw });
    if (error) return { error: "Incorrect email or password." };
    redirect(safeNext(next));
  }

  // Demo mode: any credentials open the sample Northstar workspace.
  if (pw.length < 4) return { error: "Incorrect email or password." };
  const start = addDays(todayISO(), -2);
  await writeDemoSession({
    userId: `usr-${hashString(e).toString(36)}`,
    email: e,
    fullName: e === "demo@northstarsupply.com" ? "John Carter" : nameFromEmail(e) || "John",
    role: "owner",
    companyId: "cmp-northstar",
    companyName: "Northstar Industrial Supply",
    industry: "Industrial MRO Distribution",
    trialStart: start,
    trialEnd: addDays(start, 7),
    onboarded: true,
    dataSource: "sample",
  });
  redirect(safeNext(next));
}

export async function signupAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { fullName, companyName, email: e, password: pw } = parsed.data;

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: e,
      password: pw,
      options: { data: { full_name: fullName, company_name: companyName }, emailRedirectTo: `${await origin()}/auth/callback?next=/onboarding` },
    });
    if (error) return { error: error.message };
    if (!data.session) return { message: "Check your inbox to confirm your email, then sign in to start your trial." };
    // Creates company, owner membership and 7-day trial atomically (SECURITY DEFINER function).
    const { error: rpcError } = await supabase.rpc("create_company_for_current_user", { company_name: companyName });
    if (rpcError) return { error: "Account created, but we couldn't create your company. Please contact support." };
    redirect("/onboarding");
  }

  const start = todayISO();
  await writeDemoSession({
    userId: `usr-${hashString(e).toString(36)}`,
    email: e,
    fullName,
    role: "owner",
    companyId: `cmp-${hashString(companyName + e).toString(36)}`,
    companyName,
    industry: "",
    trialStart: start,
    trialEnd: addDays(start, 7),
    onboarded: false,
    dataSource: "sample",
  });
  redirect("/onboarding");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } else {
    await clearDemoSession();
  }
  redirect("/login");
}

export async function forgotPasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  }
  // Same response whether or not the account exists (no account enumeration).
  return { message: `If an account exists for ${parsed.data.email}, a reset link is on its way.` };
}

export async function resetPasswordAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { error: "Your reset link has expired. Request a new one." };
  }
  return { message: "Password updated. You can now sign in with your new password." };
}
