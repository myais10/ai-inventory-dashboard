import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, TrialStatus } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { daysBetween, todayISO } from "@/lib/utils";
import { DEMO_COOKIE, signSession, verifySession, type DemoSessionPayload } from "./demo-session";

export interface AppSession {
  mode: "demo" | "supabase";
  user: { id: string; email: string; fullName: string; firstName: string };
  role: Role;
  company: {
    id: string;
    name: string;
    industry: string;
    trialStart: string;
    trialEnd: string;
    trialStatus: TrialStatus;
    trialDaysRemaining: number;
    dataSource: "sample" | "import";
  } | null;
  onboarded: boolean;
}

function trial(trialStart: string, trialEnd: string) {
  const remaining = Math.max(0, daysBetween(todayISO(), trialEnd));
  return { trialStart, trialEnd, trialDaysRemaining: remaining, trialStatus: (remaining > 0 ? "active" : "expired") as TrialStatus };
}

export const getSession = cache(async (): Promise<AppSession | null> => {
  if (!isSupabaseConfigured()) {
    const store = await cookies();
    const p = await verifySession(store.get(DEMO_COOKIE)?.value);
    if (!p) return null;
    return {
      mode: "demo",
      user: { id: p.userId, email: p.email, fullName: p.fullName, firstName: p.fullName.split(" ")[0] },
      role: p.role,
      company: { id: p.companyId, name: p.companyName, industry: p.industry, dataSource: p.dataSource, ...trial(p.trialStart, p.trialEnd) },
      onboarded: p.onboarded,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, companies(id, name, industry, trial_start, trial_end, onboarding_completed, data_source)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const fullName = (profile?.full_name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || user.email!.split("@")[0];
  const c = (membership?.companies ?? null) as unknown as {
    id: string; name: string; industry: string | null; trial_start: string; trial_end: string; onboarding_completed: boolean; data_source: "sample" | "import";
  } | null;
  return {
    mode: "supabase",
    user: { id: user.id, email: user.email!, fullName, firstName: fullName.split(" ")[0] },
    role: (membership?.role as Role) ?? "viewer",
    company: c
      ? { id: c.id, name: c.name, industry: c.industry ?? "", dataSource: c.data_source ?? "sample", ...trial(c.trial_start.slice(0, 10), c.trial_end.slice(0, 10)) }
      : null,
    onboarded: Boolean(c?.onboarding_completed),
  };
});

/** Use in protected server components/actions. Redirects unauthenticated users to login. */
export async function requireSession(opts: { allowIncompleteOnboarding?: boolean } = {}): Promise<AppSession & { company: NonNullable<AppSession["company"]> }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.company || (!session.onboarded && !opts.allowIncompleteOnboarding)) redirect("/onboarding");
  return session as AppSession & { company: NonNullable<AppSession["company"]> };
}

// ---------- Demo-mode session writes ----------

export async function writeDemoSession(payload: Omit<DemoSessionPayload, "iat">) {
  const store = await cookies();
  store.set(DEMO_COOKIE, await signSession({ ...payload, iat: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 14 * 86_400,
  });
}

export async function readDemoSessionPayload() {
  const store = await cookies();
  return verifySession(store.get(DEMO_COOKIE)?.value);
}

export async function clearDemoSession() {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
}
