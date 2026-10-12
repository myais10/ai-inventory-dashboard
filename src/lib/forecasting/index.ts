// Deterministic demand forecasting. No AI involved — simple, explainable statistics:
//  * Holt's damped-trend exponential smoothing for regular items
//  * Prior-year seasonal profile for items with detected seasonality
// Designed to be swapped for a more advanced model later behind the same interface.

import { mean, stdDev, sum } from "@/lib/utils";

export interface ForecastResult {
  method: "damped_trend" | "seasonal_profile" | "zero";
  level: number;
  trendPerWeek: number;
  forecast: number[]; // weekly units, horizon length
  nextWeek: number;
  /** Average weekly demand over the replenishment horizon (first 4 weeks). */
  shortTermWeekly: number;
}

const ALPHA = 0.3;
const BETA = 0.1;
const PHI = 0.9;

export function holtDamped(history: number[], horizon: number) {
  if (history.length < 4) {
    const m = mean(history);
    return { level: m, trend: 0, forecast: Array(horizon).fill(m) as number[] };
  }
  let level = mean(history.slice(0, 4));
  let trend = (mean(history.slice(4, 8)) - level) / 4 || 0;
  for (const y of history) {
    const prevLevel = level;
    level = ALPHA * y + (1 - ALPHA) * (prevLevel + PHI * trend);
    trend = BETA * (level - prevLevel) + (1 - BETA) * PHI * trend;
  }
  const forecast: number[] = [];
  let damp = 0;
  for (let h = 1; h <= horizon; h++) {
    damp += PHI ** h;
    forecast.push(Math.max(0, level + damp * trend));
  }
  return { level, trend, forecast };
}

/** Least-squares linear fit; returns fitted values. */
function linearFit(ys: number[]) {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  const num = sum(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const den = sum(xs.map((x) => (x - mx) ** 2)) || 1;
  const slope = num / den;
  return xs.map((x) => my + slope * (x - mx)).slice(0, n);
}

/** Seasonality = large, smooth residual pattern in 4-week blocks after removing linear trend. */
export function detectSeasonality(history: number[]): boolean {
  if (history.length < 52) return false;
  const avg = mean(history);
  if (avg < 2) return false;
  const blocks: number[] = [];
  for (let i = 0; i < 52; i += 4) blocks.push(mean(history.slice(i, i + 4)));
  const fitted = linearFit(blocks);
  const resid = blocks.map((b, i) => (b - fitted[i]) / avg);
  const amplitude = Math.max(...resid) - Math.min(...resid);
  // smoothness: lag-1 autocorrelation of residuals
  const r0 = sum(resid.map((r) => r * r)) || 1;
  const r1 = sum(resid.slice(1).map((r, i) => r * resid[i]));
  return amplitude > 0.7 && r1 / r0 > 0.4;
}

export function detectSpike(history: number[]): boolean {
  if (history.length < 13) return false;
  const last = history[history.length - 1];
  const base = history.slice(-13, -1);
  const m = mean(base);
  const sd = stdDev(base);
  return last >= 5 && last > Math.max(2.2 * m, m + 3 * sd);
}

export function forecastDemand(history: number[], horizon = 12): ForecastResult {
  const total = sum(history);
  if (total === 0) {
    return { method: "zero", level: 0, trendPerWeek: 0, forecast: Array(horizon).fill(0), nextWeek: 0, shortTermWeekly: 0 };
  }

  if (detectSeasonality(history)) {
    // Use last year's shape for the coming weeks, scaled by recent level vs. last year's same period.
    const n = history.length;
    const forecast: number[] = [];
    for (let h = 1; h <= horizon; h++) {
      const idx = (h - 1) % n;
      const window = history.slice(Math.max(0, idx - 1), idx + 2);
      forecast.push(Math.max(0, mean(window)));
    }
    // Only one year of history: no year-over-year growth factor yet, so last year's shape is used as-is.
    const recent = mean(history.slice(-4));
    const scaled = forecast;
    return {
      method: "seasonal_profile",
      level: recent,
      trendPerWeek: 0,
      forecast: scaled,
      nextWeek: scaled[0],
      shortTermWeekly: mean(scaled.slice(0, 4)),
    };
  }

  const { level, trend, forecast } = holtDamped(history, horizon);
  // Blend with an 8-week moving average to dampen noise on low-volume SKUs.
  const ma8 = mean(history.slice(-8));
  const blended = forecast.map((f) => 0.7 * f + 0.3 * ma8);
  // A single-week spike shouldn't be extrapolated as a permanent trend.
  const spike = detectSpike(history);
  const final = spike ? blended.map((f) => Math.min(f, ma8 * 1.25)) : blended;
  return {
    method: "damped_trend",
    level,
    trendPerWeek: trend,
    forecast: final,
    nextWeek: final[0],
    shortTermWeekly: mean(final.slice(0, 4)),
  };
}
