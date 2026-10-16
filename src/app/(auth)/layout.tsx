import { Logo } from "@/components/app/logo";

const LOOP = [
  ["Find", "Ranked queue of who to call now — and why"],
  ["Call", "One-key dispositions, notes while you talk"],
  ["Follow up", "Next action scheduled automatically"],
  ["Close", "Meetings flow straight into the pipeline"],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col bg-white px-6 py-8 sm:px-12">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <p className="text-xs text-faint">© {new Date().getFullYear()} Phoonica</p>
      </div>
      <div className="hidden flex-col justify-center bg-night px-14 lg:flex">
        <p className="text-sm font-medium text-brand-300">The calling-first sales workspace</p>
        <h2 className="mt-3 max-w-md text-[30px] font-semibold leading-tight tracking-tight text-white">Spend the day talking to the right people, not deciding who to call.</h2>
        <ol className="mt-10 max-w-md space-y-px overflow-hidden rounded-lg border border-night-3">
          {LOOP.map(([k, v], i) => (
            <li key={k} className="flex items-center gap-4 bg-night-2 px-4 py-3">
              <span className="font-mono text-xs text-brand-300">0{i + 1}</span>
              <span className="w-20 text-sm font-semibold text-white">{k}</span>
              <span className="text-sm text-white/60">{v}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
