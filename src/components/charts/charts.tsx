"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 11, fill: "#94a3b8" };
const GRID = "#eef0f3";
const BRAND = "#3b63f0";

function fmtShort(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${Math.round(v * 10) / 10}`;
}

function TooltipBox({ active, payload, label, currency }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {payload
        .filter((p) => p.value !== undefined && p.value !== null && p.name !== "band")
        .map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="capitalize">{p.name}</span>
            <span className="tabular ml-auto pl-3 font-medium">{currency ? `$${Math.round(p.value).toLocaleString()}` : Math.round(p.value * 10) / 10}</span>
          </div>
        ))}
    </div>
  );
}

export interface SeriesPoint {
  label: string;
  actual?: number;
  forecast?: number;
  lower?: number;
  upper?: number;
}

/** Actual vs forecast with confidence band. */
export function ForecastChart({ data, height = 260, currency }: { data: SeriesPoint[]; height?: number; currency?: boolean }) {
  const rows = data.map((d) => ({ ...d, band: d.lower !== undefined && d.upper !== undefined ? [d.lower, d.upper] : undefined }));
  const todayIdx = data.findIndex((d) => d.actual === undefined) - 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => (currency ? `$${fmtShort(v)}` : fmtShort(v))} width={52} />
        <Tooltip content={<TooltipBox currency={currency} />} />
        <Area dataKey="band" stroke="none" fill={BRAND} fillOpacity={0.08} isAnimationActive={false} name="band" />
        <Area dataKey="actual" stroke="#0f172a" strokeWidth={1.6} fill="#0f172a" fillOpacity={0.04} dot={false} isAnimationActive={false} name="actual" />
        <Line dataKey="forecast" stroke={BRAND} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} name="forecast" />
        {todayIdx > 0 && <ReferenceLine x={data[todayIdx].label} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "Today", position: "insideTopRight", fontSize: 10, fill: "#64748b" }} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Weekly unit sales bars + forecast line. */
export function SalesBarsChart({ data, height = 220 }: { data: SeriesPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="actual" fill="#94a3b8" radius={[2, 2, 0, 0]} isAnimationActive={false} name="units sold" />
        <Line dataKey="forecast" stroke={BRAND} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} name="forecast" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export interface ProjectionPoint {
  label: string;
  stock: number;
  safety: number;
  reorderPoint: number;
}

/** Projected on-hand stock over the coming weeks against safety stock and reorder point. */
export function ProjectionChart({ data, height = 220 }: { data: ProjectionPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<TooltipBox />} />
        <Area dataKey="stock" type="stepAfter" stroke={BRAND} strokeWidth={2} fill={BRAND} fillOpacity={0.08} isAnimationActive={false} name="projected stock" />
        <Line dataKey="reorderPoint" stroke="#f59e0b" strokeDasharray="4 4" dot={false} isAnimationActive={false} name="reorder point" />
        <Line dataKey="safety" stroke="#ef4444" strokeDasharray="4 4" dot={false} isAnimationActive={false} name="safety stock" />
        <ReferenceLine y={0} stroke="#cbd5e1" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({ data, dataKey, height = 160, color = BRAND, suffix = "" }: { data: Record<string, number | string>[]; dataKey: string; height?: number; color?: string; suffix?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}${suffix}`} domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip content={<TooltipBox />} />
        <Line dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} name={dataKey} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ data, height = 120 }: { data: { month: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" fill="#f97316" radius={[2, 2, 0, 0]} isAnimationActive={false} name="requests" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StockHistoryChart({ data, height = 200 }: { data: { label: string; stock: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<TooltipBox />} />
        <Area dataKey="stock" type="stepAfter" stroke="#0f172a" strokeWidth={1.6} fill="#0f172a" fillOpacity={0.05} isAnimationActive={false} name="on hand" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
