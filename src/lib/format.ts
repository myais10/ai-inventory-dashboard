// Display formatting shared by server and client components. Times render in the org timezone
// (passed explicitly) so server and client output match.

export function fmtPhone(e164: string | null | undefined) {
  if (!e164) return "—";
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function fmtDuration(sec: number | null | undefined) {
  if (!sec && sec !== 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtRelative(d: Date | string | null | undefined, now = new Date()) {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d) : d;
  const diff = t.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const min = Math.round(abs / 60_000);
  let v: string;
  if (min < 1) return "just now";
  if (min < 60) v = `${min}m`;
  else if (min < 60 * 24) v = `${Math.round(min / 60)}h`;
  else if (min < 60 * 24 * 30) v = `${Math.round(min / 1440)}d`;
  else v = `${Math.round(min / 43200)}mo`;
  return future ? `in ${v}` : `${v} ago`;
}

export function fmtDateTime(d: Date | string | null | undefined, tz: string, opts: { date?: boolean; time?: boolean; weekday?: boolean } = { date: true, time: true }) {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    ...(opts.weekday ? { weekday: "short" } : {}),
    ...(opts.date !== false ? { month: "short", day: "numeric" } : {}),
    ...(opts.time !== false ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(t);
}

export function fmtMoney(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1000) {
    return Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : `$${Math.round(n / 1000)}K`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function fmtPct(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Value for <input type="datetime-local"> in a given timezone. */
export function toLocalInput(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
