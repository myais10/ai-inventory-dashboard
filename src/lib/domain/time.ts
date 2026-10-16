// Timezone-aware calling-hours helpers. Contacts carry an IANA timezone; reps should only be
// prompted to call during the contact's local business hours.

export const CALL_START_HOUR = 9;
export const CALL_END_HOUR = 17;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  return f;
}

export function localParts(d: Date, tz: string) {
  const parts = partsFormatter(tz).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  return { hour: Number(get("hour")), minute: Number(get("minute")), weekday, isWeekend: weekday === "Sat" || weekday === "Sun" };
}

const callableMemo = new Map<string, boolean>();

export function isCallingHours(d: Date, tz: string) {
  // Memoised per 15-minute bucket: ranking evaluates this for every queued lead.
  const key = `${tz}|${Math.floor(d.getTime() / 900_000)}`;
  let v = callableMemo.get(key);
  if (v === undefined) {
    const p = localParts(d, tz);
    v = !p.isWeekend && p.hour >= CALL_START_HOUR && p.hour < CALL_END_HOUR;
    if (callableMemo.size > 20_000) callableMemo.clear();
    callableMemo.set(key, v);
  }
  return v;
}

/** The instant at which the wall clock in `tz` reads y-m-d h:mi (m is 1-based). */
export function zonedDate(y: number, m: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  return new Date(guess - (asLocal - guess));
}

/** Earliest moment ≥ d that falls inside the contact's local calling hours (30-minute resolution). */
export function nextCallingTime(d: Date, tz: string): Date {
  let t = new Date(d);
  for (let i = 0; i < 7 * 48; i++) {
    if (isCallingHours(t, tz)) return t;
    t = new Date(t.getTime() + 30 * 60_000);
  }
  return d;
}

export function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3_600_000);
}

/** n business days later (skipping weekends in the contact's timezone), at the same wall time, then nudged into calling hours. */
export function addBusinessDays(d: Date, n: number, tz: string): Date {
  let t = new Date(d);
  let added = 0;
  while (added < n) {
    t = addHours(t, 24);
    if (!localParts(t, tz).isWeekend) added++;
  }
  return nextCallingTime(t, tz);
}

export function localTimeLabel(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
}

export function tzShort(tz: string, d = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(d);
  return p.find((x) => x.type === "timeZoneName")?.value ?? tz;
}

/** Parses a datetime-local value ("2026-10-19T10:30") as wall time in `tz`. */
export function parseLocalInput(v: string, tz: string): Date | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedDate(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
}
