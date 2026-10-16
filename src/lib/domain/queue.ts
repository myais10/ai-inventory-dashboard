// Next Best Lead: ranks callable leads so a rep always knows who to call next and why.
// Priority = lead score + time-sensitive boosts (promised callbacks, speed-to-lead on inbound,
// overdue follow-ups) − contacts outside their local calling hours.

import { isCallingHours, localTimeLabel } from "./time";

export interface QueueCandidate {
  id: string;
  score: number;
  status: string;
  source: string;
  attemptCount: number;
  nextActionAt: Date | null;
  nextActionType: string | null;
  createdAt: Date;
  timezone: string;
}

export interface RankedLead<T extends QueueCandidate = QueueCandidate> {
  lead: T;
  priority: number;
  callableNow: boolean;
  reasons: string[];
}

const INBOUND = new Set(["inbound_demo", "referral"]);

function ago(ms: number) {
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)} days`;
}

export function rankLead<T extends QueueCandidate>(l: T, now: Date): RankedLead<T> {
  const reasons: string[] = [];
  let p = l.score;
  const callableNow = isCallingHours(now, l.timezone);

  if (l.nextActionType === "callback") {
    const late = l.nextActionAt ? now.getTime() - l.nextActionAt.getTime() : 0;
    p += 60 + Math.min(20, late / 3_600_000);
    reasons.push(late > 15 * 60_000 ? `Promised callback, ${ago(late)} overdue` : "Promised callback is due now");
  } else if (l.attemptCount === 0) {
    if (INBOUND.has(l.source)) {
      const age = now.getTime() - l.createdAt.getTime();
      // Speed to lead: contact rates fall off sharply after the first hour.
      p += age < 3_600_000 ? 50 : age < 86_400_000 ? 35 : 20;
      reasons.push(`Inbound lead waiting ${ago(age)} — speed to lead matters`);
    } else {
      p += 8;
      reasons.push("Never contacted");
    }
  } else if (l.nextActionAt) {
    const late = now.getTime() - l.nextActionAt.getTime();
    if (late > 86_400_000) {
      p += 10;
      reasons.push(`Follow-up ${ago(late)} overdue`);
    } else {
      reasons.push(`Scheduled retry (attempt ${l.attemptCount + 1})`);
    }
  }
  if (l.status === "connected") {
    p += 12;
    reasons.push("Already in conversation");
  }
  if (l.score >= 60) reasons.push(`High-fit lead (score ${l.score})`);
  if (!callableNow) {
    p -= 80;
    reasons.push(`Outside calling hours — ${localTimeLabel(now, l.timezone)} local`);
  }
  return { lead: l, priority: Math.round(p), callableNow, reasons };
}

export function isDue(l: Pick<QueueCandidate, "nextActionAt" | "nextActionType">, now: Date) {
  if (l.nextActionType === "none") return false;
  return !l.nextActionAt || l.nextActionAt.getTime() <= now.getTime();
}

export function rankQueue<T extends QueueCandidate>(leads: T[], now: Date): RankedLead<T>[] {
  return leads
    .filter((l) => isDue(l, now))
    .map((l) => rankLead(l, now))
    .sort((a, b) => b.priority - a.priority);
}
