// In-memory router for the browser-only build. Replaces Next's App Router.
export interface Loc {
  path: string;
  query: Record<string, string>;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function parse(href: string): Loc {
  const [p, q = ""] = href.split("?");
  const query: Record<string, string> = {};
  new URLSearchParams(q).forEach((v, k) => (query[k] = v));
  return { path: p || "/", query };
}

let current: Loc = parse("/");
let tick = 0;

export function getLoc() {
  return current;
}
export function getTick() {
  return tick;
}
export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function emit() {
  listeners.forEach((l) => l());
}

export function navigate(href: string) {
  if (!href.startsWith("/")) return;
  current = parse(href);
  tick++;
  emit();
  try {
    window.scrollTo(0, 0);
  } catch {}
}

export function refresh() {
  tick++;
  emit();
}

export class RedirectSignal extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}
export class NotFoundSignal extends Error {
  constructor() {
    super("not-found");
  }
}
