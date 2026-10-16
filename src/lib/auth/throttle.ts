// Failed-login throttle over a 15-minute window: 8 failures per email, 50 per client IP (higher, as
// offices share IPs). IP is only used when known, so a missing proxy header can't lock everyone out.
// In-process memory, so limits are per server instance — use a shared store (e.g. Redis) when
// running multiple instances.

const WINDOW_MS = 15 * 60_000;
const limitFor = (key: string) => (key.startsWith("ip:") ? 50 : 8);
const failures = new Map<string, number[]>();

function recent(key: string, now = Date.now()) {
  const xs = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (xs.length) failures.set(key, xs);
  else failures.delete(key);
  return xs;
}

export function isThrottled(keys: string[]) {
  return keys.some((k) => recent(k).length >= limitFor(k));
}

export function recordFailure(keys: string[]) {
  const now = Date.now();
  for (const k of keys) failures.set(k, [...recent(k, now), now]);
  if (failures.size > 50_000) failures.clear();
}

export function clearFailures(keys: string[]) {
  for (const k of keys) failures.delete(k);
}
