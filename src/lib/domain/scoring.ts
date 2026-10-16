// Explainable lead scoring (0–100). Every point is attributed to a named factor so reps can see
// *why* a lead ranks where it does. Fit (who they are) + intent (how they arrived) + engagement
// (what happened on calls) − friction (unreachable, bad data).

import type { ScoreFactor } from "@/lib/db/schema";
import type { LeadStatus } from "./dispositions";

export interface ScoringInput {
  status: LeadStatus;
  source: string;
  attemptCount: number;
  connectCount: number;
  lastDisposition: string | null;
  createdAt: Date;
  contact: { seniority: string | null; phone: string | null; mobile: string | null; phoneInvalid: boolean; doNotCall: boolean };
  company: { industry: string | null; employeeCount: number | null; annualRevenue: number | null } | null;
  icp: { industries: string[]; minEmployees: number; maxEmployees: number };
}

export const SOURCES: Record<string, { label: string; points: number }> = {
  inbound_demo: { label: "Inbound demo request", points: 22 },
  referral: { label: "Referral", points: 16 },
  webinar: { label: "Webinar attendee", points: 12 },
  event: { label: "Trade show / event", points: 10 },
  content: { label: "Content download", points: 8 },
  outbound_list: { label: "Outbound list", points: 0 },
};

const SENIORITY: Record<string, { label: string; points: number }> = {
  c_level: { label: "C-level decision maker", points: 12 },
  vp: { label: "VP-level buyer", points: 10 },
  director: { label: "Director-level", points: 8 },
  manager: { label: "Manager", points: 4 },
};

export function scoreLead(i: ScoringInput, now: Date): { score: number; factors: ScoreFactor[] } {
  const f: ScoreFactor[] = [];
  const add = (key: string, label: string, points: number) => points !== 0 && f.push({ key, label, points });

  // Fit
  const c = i.company;
  if (c?.industry && i.icp.industries.includes(c.industry)) add("icp_industry", `ICP industry (${c.industry})`, 15);
  if (c?.employeeCount) {
    if (c.employeeCount >= i.icp.minEmployees && c.employeeCount <= i.icp.maxEmployees) add("icp_size", `ICP company size (${c.employeeCount} employees)`, 12);
    else if (c.employeeCount >= i.icp.minEmployees / 2 && c.employeeCount <= i.icp.maxEmployees * 2) add("near_size", "Near ICP company size", 5);
  }
  if (c?.annualRevenue && c.annualRevenue >= 10_000_000) add("revenue", "Revenue over $10M", 6);
  const s = i.contact.seniority ? SENIORITY[i.contact.seniority] : undefined;
  if (s) add("seniority", s.label, s.points);
  if (i.contact.mobile) add("direct_dial", "Direct mobile available", 5);
  else if (i.contact.phone) add("phone", "Direct phone available", 2);

  // Intent
  const src = SOURCES[i.source];
  if (src) add("source", src.label, src.points);
  const ageDays = (now.getTime() - i.createdAt.getTime()) / 86_400_000;
  if (ageDays <= 3 && i.attemptCount === 0) add("fresh", "Fresh lead (< 3 days old)", 5);

  // Engagement
  if (i.connectCount > 0) add("connected", `Reached on ${i.connectCount} call${i.connectCount > 1 ? "s" : ""}`, Math.min(14, 8 + i.connectCount * 2));
  if (i.lastDisposition === "interested" || i.lastDisposition === "callback") add("interest", "Expressed interest on last call", 12);
  if (i.status === "qualified") add("qualified", "Qualified (meeting booked)", 15);

  // Friction
  const unreached = i.attemptCount - i.connectCount;
  if (i.connectCount === 0 && unreached >= 3) add("unreachable", `${unreached} attempts without a connect`, -Math.min(15, (unreached - 2) * 3));
  if (i.contact.phoneInvalid) add("bad_phone", "Phone number flagged invalid", -20);
  if (i.contact.doNotCall) add("dnc", "Do not call", -40);
  if (i.status === "unqualified") add("unqualified", "Marked unqualified", -30);

  const raw = f.reduce((a, x) => a + x.points, 0);
  return { score: Math.max(0, Math.min(100, raw)), factors: f.sort((a, b) => b.points - a.points) };
}

export function scoreTier(score: number): { label: string; tone: "green" | "amber" | "slate" } {
  if (score >= 60) return { label: "Hot", tone: "green" };
  if (score >= 35) return { label: "Warm", tone: "amber" };
  return { label: "Cold", tone: "slate" };
}
