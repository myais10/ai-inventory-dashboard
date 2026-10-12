import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col bg-white px-6 py-8 sm:px-12">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
        <p className="text-xs text-faint">© {new Date().getFullYear()} AI Inventory & Demand Intelligence</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0b1430] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,99,240,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(59,99,240,0.18),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="text-sm font-medium text-brand-200">For parts & industrial distributors</p>
          <h2 className="mt-3 max-w-md text-[32px] font-semibold leading-tight tracking-tight text-white">
            Your ERP tells you what you have. We tell you what to do about it.
          </h2>
          <ul className="mt-8 space-y-3 text-[15px] text-white/80">
            {["Reorder recommendations with exact quantities", "Stockout warnings before they hit customers", "Find cash tied up in excess and dead stock", "See demand you're losing to competitors"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-brand-200" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-12 max-w-md rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-400" /> High priority
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white">SKF 6205 Bearing — stockout in 9 days</div>
            <div className="mt-1 text-xs text-white/60">42 in stock · 31/week demand · 14-day lead time</div>
            <div className="mt-3 inline-flex rounded-md bg-white px-2.5 py-1 text-xs font-medium text-ink">Order 100 units today</div>
          </div>
        </div>
      </div>
    </div>
  );
}
