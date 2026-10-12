// Browser replacement for src/lib/auth/session.ts: same API, session kept in memory
// (mirrored to localStorage when available) instead of a signed HTTP-only cookie.
import type { Role, TrialStatus } from "@/lib/types";
import type { DemoSessionPayload } from "@/lib/auth/demo-session";
import { daysBetween, todayISO } from "@/lib/utils";
import { redirect } from "./next-navigation";

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

const KEY = "aii.demo-session";
let payload: DemoSessionPayload | null = null;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) payload = JSON.parse(raw);
} catch {}
// An imported dataset lives only in memory, so a stored "import" session falls back to sample data on reload.
if (payload?.dataSource === "import") payload = { ...payload, dataSource: "sample" };

function persist() {
  try {
    if (payload) localStorage.setItem(KEY, JSON.stringify(payload));
    else localStorage.removeItem(KEY);
  } catch {}
}

export async function getSession(): Promise<AppSession | null> {
  const p = payload;
  if (!p) return null;
  const remaining = Math.max(0, daysBetween(todayISO(), p.trialEnd));
  return {
    mode: "demo",
    user: { id: p.userId, email: p.email, fullName: p.fullName, firstName: p.fullName.split(" ")[0] },
    role: p.role,
    company: {
      id: p.companyId,
      name: p.companyName,
      industry: p.industry,
      dataSource: p.dataSource,
      trialStart: p.trialStart,
      trialEnd: p.trialEnd,
      trialDaysRemaining: remaining,
      trialStatus: remaining > 0 ? "active" : "expired",
    },
    onboarded: p.onboarded,
  };
}

export async function requireSession(opts: { allowIncompleteOnboarding?: boolean } = {}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.company || (!session.onboarded && !opts.allowIncompleteOnboarding)) redirect("/onboarding");
  return session as AppSession & { company: NonNullable<AppSession["company"]> };
}

export async function writeDemoSession(p: Omit<DemoSessionPayload, "iat">) {
  payload = { ...p, iat: Date.now() };
  persist();
}
export async function readDemoSessionPayload() {
  return payload;
}
export async function clearDemoSession() {
  payload = null;
  persist();
}
