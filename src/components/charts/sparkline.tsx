import { cn } from "@/lib/utils";

/** Lightweight inline SVG sparkline (server-renderable). */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  className,
  stroke = "currentColor",
  fill = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: boolean;
}) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden>
      {fill && <path d={`${d} L${width},${height} L0,${height} Z`} fill={stroke} opacity={0.08} />}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={stroke} />
    </svg>
  );
}

/** Horizontal stacked bar used for composition (e.g. inventory by status). */
export function StackedBar({ segments, className }: { segments: { value: number; className: string; label: string }[]; className?: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className={cn("flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      {segments.map((s) => (
        <div key={s.label} title={s.label} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} />
      ))}
    </div>
  );
}
