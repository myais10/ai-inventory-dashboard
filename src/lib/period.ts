import { zonedDate } from "@/lib/domain/time";

export const PERIODS = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

/** Period ending now, starting at local midnight `days-1` days ago, plus the equal-length period before it. */
export function resolvePeriod(key: string | undefined, tz: string, fallback: PeriodKey = "today") {
  const p = PERIODS.find((x) => x.key === key) ?? PERIODS.find((x) => x.key === fallback)!;
  const now = new Date();
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now).split("-").map(Number);
  const todayStart = zonedDate(y, m, d, 0, 0, tz);
  const since = new Date(todayStart.getTime() - (p.days - 1) * 86_400_000);
  const prevSince = new Date(since.getTime() - p.days * 86_400_000);
  // Compare like with like: the previous period up to the same elapsed point.
  const prevUntil = new Date(prevSince.getTime() + (now.getTime() - since.getTime()));
  return { ...p, since, until: now, prevSince, prevUntil, compareLabel: p.key === "today" ? "vs. same time yesterday" : `vs. previous ${p.label}` };
}
