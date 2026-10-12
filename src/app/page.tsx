import Link from "next/link";
import { AlertTriangle, ArrowRight, PackageX, SearchX, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { getSession } from "@/lib/auth/session";
import { sampleWorkspace } from "@/lib/data";
import { fmtCompactCurrency } from "@/lib/utils";

const FEATURES = [
  { icon: ShoppingCart, title: "Reorder intelligence", body: "Exact order quantities from sales velocity, lead times, open POs, safety stock and MOQs." },
  { icon: AlertTriangle, title: "Stockout risk", body: "See which SKUs will run out before replenishment arrives — and what to do today." },
  { icon: PackageX, title: "Excess & dead stock", body: "Find the cash tied up in slow-moving inventory and get a plan to release it." },
  { icon: SearchX, title: "Lost demand", body: "Surface the products customers keep asking for that you don't stock." },
  { icon: TrendingUp, title: "Demand intelligence", body: "Trends, seasonality, spikes and forecasts across your whole catalog." },
  { icon: Truck, title: "Supplier intelligence", body: "Actual lead times, reliability, delays, price changes and dependencies." },
];

export default async function LandingPage() {
  const session = await getSession();
  const { kpis } = sampleWorkspace();
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {session ? (
            <Link href="/dashboard" className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-slate-100">
                Sign in
              </Link>
              <Link href="/signup" className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-subtle px-3 py-1 text-xs font-medium text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Built for parts & industrial distributors
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[56px]">
            Your ERP tells you what you have.
            <br />
            <span className="text-brand-600">We tell you what to do about it.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            AI Inventory & Demand Intelligence analyses your inventory, sales, purchasing, suppliers and customer enquiries — and turns them into clear purchasing actions every morning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              Start 7-day free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium text-ink-2 ring-1 ring-inset ring-line-strong hover:bg-subtle">
              View live demo
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 rounded-2xl border border-line bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [fmtCompactCurrency(kpis.totalInventory), "Inventory analysed", "Northstar sample workspace"],
            [String(kpis.reorderRequired), "SKUs to reorder today", "with exact quantities"],
            [String(kpis.stockoutRisks), "Stockouts caught early", "before lead time runs out"],
            [fmtCompactCurrency(kpis.excessInventory), "Excess capital found", "ready to release"],
          ].map(([v, l, s]) => (
            <div key={l} className="rounded-xl bg-white p-5 ring-1 ring-line">
              <div className="tabular text-3xl font-semibold tracking-tight text-ink">{v}</div>
              <div className="mt-1 text-sm font-medium text-ink-2">{l}</div>
              <div className="text-xs text-muted">{s}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-canvas py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Answers to “What do I need to know?” and “What should I do next?”</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-white p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-3xl text-sm text-muted">
            Every quantity, date and dollar figure is calculated by a transparent, deterministic engine. AI is used only to explain and summarise — never to invent purchasing numbers.
          </p>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-faint">© {new Date().getFullYear()} AI Inventory & Demand Intelligence</footer>
    </div>
  );
}
