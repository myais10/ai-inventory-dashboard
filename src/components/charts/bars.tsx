// Minimal, dependency-free charts. Single series only (title names it, so no legend box);
// every chart ships an accessible table and per-bar hover/focus tooltips.

import { cn } from "@/lib/utils";

export interface Bar {
  label: string;
  value: number;
  tooltip?: string;
  /** Mark a bar as muted (e.g. a weekend or low-sample bucket). */
  muted?: boolean;
}

export function ColumnChart({
  title,
  bars,
  format = (n) => n.toLocaleString(),
  height = 140,
  labelEvery = 1,
}: {
  title: string;
  bars: Bar[];
  format?: (n: number) => string;
  height?: number;
  labelEvery?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const peak = bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0] ?? { label: "", value: 0 });
  return (
    <figure className="m-0">
      <div role="img" aria-label={`${title}. ${bars.length} values; highest ${format(peak.value)} (${peak.label}).`}>
        <div className="flex items-end gap-[2px] border-b border-line" style={{ height }} aria-hidden>
          {bars.map((b) => (
            <div key={b.label} className="group relative flex h-full flex-1 items-end" tabIndex={0}>
              <div
                className={cn("w-full rounded-t-[4px] transition-colors", b.muted ? "bg-slate-200" : "bg-brand-500 group-hover:bg-brand-700 group-focus:bg-brand-700")}
                style={{ height: `${Math.max(b.value ? 2 : 0, (b.value / max) * 100)}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-night px-2 py-1 text-[11px] text-white shadow-lg group-hover:block group-focus:block">
                <span className="font-medium">{b.label}</span> · {b.tooltip ?? format(b.value)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[2px]" aria-hidden>
          {bars.map((b, i) => (
            <div key={b.label} className="relative h-3.5 flex-1 text-[10px] text-faint">
              {i % labelEvery === 0 && <span className={cn("absolute top-0 whitespace-nowrap", labelEvery > 1 ? "left-0" : "left-1/2 -translate-x-1/2")}>{b.label}</span>}
            </div>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>{b.tooltip ?? format(b.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Ranked horizontal bars with text label + value; doubles as its own table. */
export function BarList({ rows, format = (n) => n.toLocaleString(), caption }: { rows: { label: string; value: number; sub?: string }[]; format?: (n: number) => string; caption: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-4 text-[13px] text-muted">No data for this period.</p>;
  return (
    <table className="w-full text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row" className="w-[42%] py-1 pr-3 text-left font-normal text-ink-2">
              <span className="block truncate">{r.label}</span>
            </th>
            <td className="py-1">
              <div className="h-2 rounded-r-[4px] bg-brand-500" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 2 : 0 }} aria-hidden />
            </td>
            <td className="tabular w-20 py-1 pl-3 text-right text-ink">
              {format(r.value)}
              {r.sub && <span className="block text-[11px] text-faint">{r.sub}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
