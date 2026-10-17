import { Logo } from "@/components/app/logo";

const LOOP = [
  ["Find", "Who to call now — and why"],
  ["Call", "One-key outcomes, notes while you talk"],
  ["Follow up", "Next action scheduled automatically"],
  ["Close", "Meetings flow straight into the pipeline"],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col bg-canvas px-6 py-8 sm:px-12">
        <Logo tagline />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <p className="text-xs text-faint">© {new Date().getFullYear()} Phoonica</p>
      </div>
      <div className="hidden flex-col justify-center border-l border-line bg-surface px-14 lg:flex">
        <h2 className="max-w-lg text-[32px] font-medium leading-[1.2] tracking-tight text-ink-2">
          The calling-first
          <span className="block font-semibold text-brand-300">CRM &amp; sales desk</span>
          for modern sales teams.
        </h2>
        <ol className="mt-10 max-w-md divide-y divide-line overflow-hidden rounded-lg border border-line bg-subtle">
          {LOOP.map(([k, v], i) => (
            <li key={k} className="flex items-center gap-4 px-4 py-3">
              <span className="font-mono text-xs text-brand-300">0{i + 1}</span>
              <span className="w-20 text-sm font-semibold text-ink">{k}</span>
              <span className="text-sm text-muted">{v}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
