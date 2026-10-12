// Browser-only build of the app for static hosting. Reuses every page, engine and component from
// src/; Next.js server features (routing, cookies, server actions) are replaced by shims in ./shims.
import { Component, createElement, useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { getLoc, getTick, navigate, subscribe, NotFoundSignal, RedirectSignal, type Loc } from "./shims/router";
import { getSession } from "./shims/session";
import { GET as sampleCsv } from "@/app/api/samples/[name]/route";

import Landing from "@/app/page";
import NotFound from "@/app/not-found";
import AuthLayout from "@/app/(auth)/layout";
import Login from "@/app/(auth)/login/page";
import Signup from "@/app/(auth)/signup/page";
import ForgotPassword from "@/app/(auth)/forgot-password/page";
import ResetPassword from "@/app/(auth)/reset-password/page";
import Onboarding from "@/app/onboarding/page";
import AppLayout from "@/app/(app)/layout";
import Dashboard from "@/app/(app)/dashboard/page";
import Recommendations from "@/app/(app)/recommendations/page";
import RecReorder from "@/app/(app)/recommendations/reorder/page";
import RecStockout from "@/app/(app)/recommendations/stockout-risk/page";
import RecExcess from "@/app/(app)/recommendations/excess/page";
import RecLost from "@/app/(app)/recommendations/lost-demand/page";
import RecDetail from "@/app/(app)/recommendations/[id]/page";
import Inventory from "@/app/(app)/inventory/page";
import InventoryHealth from "@/app/(app)/inventory/health/page";
import Product from "@/app/(app)/products/[sku]/page";
import DemandForecast from "@/app/(app)/demand/forecast/page";
import DemandTrends from "@/app/(app)/demand/trends/page";
import DemandLost from "@/app/(app)/demand/lost-demand/page";
import Suppliers from "@/app/(app)/suppliers/page";
import SupplierPerformance from "@/app/(app)/suppliers/performance/page";
import LeadTimes from "@/app/(app)/suppliers/lead-times/page";
import SupplierDetail from "@/app/(app)/suppliers/[code]/page";
import Reports from "@/app/(app)/reports/page";
import Report from "@/app/(app)/reports/[slug]/page";
import SettingsCompany from "@/app/(app)/settings/company/page";
import SettingsUsers from "@/app/(app)/settings/users/page";
import SettingsData from "@/app/(app)/settings/data-sources/page";
import SettingsWarehouses from "@/app/(app)/settings/warehouses/page";
import SettingsBilling from "@/app/(app)/settings/billing/page";
import SettingsProfile from "@/app/(app)/settings/profile/page";

/* eslint-disable @typescript-eslint/no-explicit-any */
type PageFn = (props: { params: Promise<any>; searchParams: Promise<any> }) => ReactNode | Promise<ReactNode>;
type LayoutFn = (props: { children: ReactNode }) => ReactNode | Promise<ReactNode>;
interface Route {
  pattern: string;
  page: PageFn;
  layout?: LayoutFn;
  redirectTo?: string;
}

const auth = AuthLayout as LayoutFn;
const app = AppLayout as unknown as LayoutFn;
const P = (c: unknown) => c as PageFn;

const ROUTES: Route[] = [
  { pattern: "/", page: P(Landing) },
  { pattern: "/login", page: P(Login), layout: auth },
  { pattern: "/signup", page: P(Signup), layout: auth },
  { pattern: "/forgot-password", page: P(ForgotPassword), layout: auth },
  { pattern: "/reset-password", page: P(ResetPassword), layout: auth },
  { pattern: "/onboarding", page: P(Onboarding) },
  { pattern: "/dashboard", page: P(Dashboard), layout: app },
  { pattern: "/recommendations", page: P(Recommendations), layout: app },
  { pattern: "/recommendations/reorder", page: P(RecReorder), layout: app },
  { pattern: "/recommendations/stockout-risk", page: P(RecStockout), layout: app },
  { pattern: "/recommendations/excess", page: P(RecExcess), layout: app },
  { pattern: "/recommendations/lost-demand", page: P(RecLost), layout: app },
  { pattern: "/recommendations/:id", page: P(RecDetail), layout: app },
  { pattern: "/inventory", page: P(Inventory), layout: app },
  { pattern: "/inventory/health", page: P(InventoryHealth), layout: app },
  { pattern: "/products/:sku", page: P(Product), layout: app },
  { pattern: "/demand", page: P(DemandForecast), layout: app, redirectTo: "/demand/forecast" },
  { pattern: "/demand/forecast", page: P(DemandForecast), layout: app },
  { pattern: "/demand/trends", page: P(DemandTrends), layout: app },
  { pattern: "/demand/lost-demand", page: P(DemandLost), layout: app },
  { pattern: "/suppliers", page: P(Suppliers), layout: app },
  { pattern: "/suppliers/performance", page: P(SupplierPerformance), layout: app },
  { pattern: "/suppliers/lead-times", page: P(LeadTimes), layout: app },
  { pattern: "/suppliers/:code", page: P(SupplierDetail), layout: app },
  { pattern: "/reports", page: P(Reports), layout: app },
  { pattern: "/reports/:slug", page: P(Report), layout: app },
  { pattern: "/settings", page: P(SettingsCompany), layout: app, redirectTo: "/settings/company" },
  { pattern: "/settings/company", page: P(SettingsCompany), layout: app },
  { pattern: "/settings/users", page: P(SettingsUsers), layout: app },
  { pattern: "/settings/data-sources", page: P(SettingsData), layout: app },
  { pattern: "/settings/warehouses", page: P(SettingsWarehouses), layout: app },
  { pattern: "/settings/billing", page: P(SettingsBilling), layout: app },
  { pattern: "/settings/profile", page: P(SettingsProfile), layout: app },
];

function match(path: string): { route: Route; params: Record<string, string> } | null {
  const segs = path.replace(/\/+$/, "").split("/").filter(Boolean);
  // Static patterns win over dynamic ones (same rule as Next.js).
  const ordered = [...ROUTES].sort((a, b) => Number(a.pattern.includes(":")) - Number(b.pattern.includes(":")));
  for (const route of ordered) {
    const ps = route.pattern.split("/").filter(Boolean);
    if (ps.length !== segs.length) continue;
    const params: Record<string, string> = {};
    if (ps.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = segs[i]), true) : p === segs[i]))) return { route, params };
  }
  return null;
}

const PUBLIC = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password"]);

function call(fn: (props: any) => ReactNode | Promise<ReactNode>, props: any): ReactNode | Promise<ReactNode> {
  return fn.constructor.name === "AsyncFunction" ? fn(props) : createElement(fn as ComponentType<any>, props);
}

async function resolve(loc: Loc): Promise<ReactNode> {
  const m = match(loc.path);
  if (!m) return <NotFound />;
  if (m.route.redirectTo) throw new RedirectSignal(m.route.redirectTo);
  // Middleware equivalent.
  const session = await getSession();
  if (!session && !PUBLIC.has(loc.path)) throw new RedirectSignal("/login");
  if (session && (loc.path === "/login" || loc.path === "/signup")) throw new RedirectSignal("/dashboard");
  // Async (server) components are awaited here; ordinary components with hooks render as elements.
  const page = await call(m.route.page, { params: Promise.resolve(m.params), searchParams: Promise.resolve(loc.query) });
  return m.route.layout ? await call(m.route.layout, { children: page }) : page;
}

function handleSignal(err: unknown) {
  if (err instanceof RedirectSignal || (err as Error)?.message?.startsWith("redirect:")) {
    navigate(err instanceof RedirectSignal ? err.to : (err as Error).message.slice(9));
    return true;
  }
  return false;
}

/** Catches redirect() thrown from form actions (login, signup, sign out) and turns it into navigation. */
class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown) {
    if (handleSignal(error)) this.setState({ error: null });
  }
  render() {
    const e = this.state.error;
    if (e && !(e instanceof RedirectSignal)) {
      return (
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-ink">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted">{String((e as Error).message ?? e)}</p>
          <button type="button" onClick={() => this.setState({ error: null })} className="mt-5 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const tick = useSyncExternalStore(subscribe, getTick);
  const [view, setView] = useState<ReactNode>(null);
  useEffect(() => {
    let cancelled = false;
    resolve(getLoc())
      .then((v) => !cancelled && setView(v))
      .catch((err) => {
        if (cancelled) return;
        if (handleSignal(err)) return;
        if (err instanceof NotFoundSignal) return setView(<NotFound />);
        console.error(err);
        setView(<div className="p-10 text-sm text-red-700">Error: {String(err?.message ?? err)}</div>);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);
  return <Boundary>{view ?? <div className="p-10 text-sm text-muted">Loading…</div>}</Boundary>;
}

// Serve the onboarding sample CSVs from the in-browser route handler.
const realFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  const m = url.match(/\/api\/samples\/([\w.]+)$/);
  if (m) return sampleCsv(new Request("https://local" + url), { params: Promise.resolve({ name: m[1] }) });
  return realFetch(input, init);
};

// Optional deep link: #dashboard, #inventory, #recommendations …
const start = (() => {
  try {
    const h = location.hash.replace(/^#\/?/, "");
    return h ? `/${h.replace(/[^a-z0-9/-]/gi, "")}` : "/";
  } catch {
    return "/";
  }
})();
navigate(start);
try {
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace(/^#\/?/, "").replace(/[^a-z0-9/-]/gi, "");
    if (h) navigate(`/${h}`);
  });
} catch {}

createRoot(document.getElementById("root")!, {
  // Redirects thrown from form actions are expected navigation, not errors.
  onCaughtError: (error) => {
    if (!(error instanceof RedirectSignal) && !String((error as Error)?.message).startsWith("redirect:")) console.error(error);
  },
}).render(<App />);

export type { ComponentType };
