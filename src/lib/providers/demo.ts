// Demo implementations. They never contact the outside world and identify themselves as
// simulated (live: false) so the UI can label them honestly.

import { randomUUID } from "node:crypto";
import type { AIProvider, CalendarProvider, EmailProvider, EnrichmentProvider, MessagingProvider, PhoneProvider } from "./types";

export const demoPhone: PhoneProvider = {
  id: "demo",
  name: "Demo dialer",
  live: false,
  description: "Simulates call placement so the full desk workflow can be used. No real call is made — dial from your own phone and log the outcome here.",
  async placeCall() {
    return { providerCallId: `demo_${randomUUID().slice(0, 12)}`, status: "in_progress" };
  },
  async hangup() {},
  async getRecordingUrl() {
    return null;
  },
};

export const demoEmail: EmailProvider = {
  id: "demo",
  name: "Demo email",
  live: false,
  description: "Records emails on the timeline without sending them.",
  async send() {
    return { providerMessageId: `demo_${randomUUID().slice(0, 12)}`, delivered: false };
  },
};

const OBJECTIONS: Record<string, { objection: string; response: string }> = {
  default: { objection: "“We already have something for that.”", response: "Ask what they'd change about it if they could — most teams outgrow spreadsheets and basic tools around 10+ techs." },
  small: { objection: "“We're too small for software like this.”", response: "Teams their size usually feel it first in missed appointments; offer the 2-week pilot on one crew." },
  callback: { objection: "“Now isn't a good time.”", response: "They asked for this callback — confirm it's still a good time, then go straight to the one question that matters." },
};

/** Rules-based call prep from the lead's real data. Swap for an LLM-backed provider later. */
export const demoAI: AIProvider = {
  id: "demo",
  name: "Rules-based call prep",
  live: false,
  description: "Builds call prep from lead data with fixed rules. Connect an AI provider for generated prep.",
  async callPrep(i) {
    const first = i.contactName.split(" ")[0];
    const techs = i.employeeCount ? Math.max(4, Math.round(i.employeeCount * 0.35)) : null;
    const opener =
      i.lastDisposition === "callback"
        ? `Hi ${first}, it's ${i.repName} from ${i.sellerName} — you asked me to call back about dispatch scheduling. Still a good time?`
        : i.source === "inbound_demo"
          ? `Hi ${first}, it's ${i.repName} from ${i.sellerName} — you just requested a demo. I wanted to learn what prompted it so we show you the right things.`
          : `Hi ${first}, it's ${i.repName} from ${i.sellerName}. I work with ${i.industry ?? "field service"} teams in ${i.city ?? "your area"} — do you have 30 seconds for why I called?`;
    const points = [
      techs ? `~${techs} field techs at ${i.companyName} — ask how jobs get assigned today.` : `Ask how ${i.companyName ?? "they"} assign jobs today.`,
      i.title?.match(/owner|ceo|president|coo/i) ? "Decision maker — focus on revenue lost to scheduling gaps and admin time." : "Likely an operator — focus on daily dispatch pain and ask who signs off.",
      ...(i.lastNotes[0] ? [`Last note: “${i.lastNotes[0].slice(0, 120)}”`] : []),
      i.attemptCount >= 3 ? `${i.attemptCount} attempts so far — if voicemail again, leave a short, specific message.` : "Goal: book a 30-minute discovery call.",
    ];
    const likelyObjection = i.lastDisposition === "callback" ? OBJECTIONS.callback : (i.employeeCount ?? 0) < 40 ? OBJECTIONS.small : OBJECTIONS.default;
    return { opener, talkingPoints: points, likelyObjection };
  },
};

export const demoEnrichment: EnrichmentProvider = {
  id: "demo",
  name: "Demo enrichment",
  live: false,
  description: "Returns no new data. Connect an enrichment provider to fill missing firmographics and direct dials.",
  async enrichContact() {
    return null;
  },
};

export const demoCalendar: CalendarProvider = {
  id: "demo",
  name: "Demo calendar",
  live: false,
  description: "Meetings are stored in Phoonica only; no calendar invite is sent.",
  async createEvent() {
    return { externalId: `demo_${randomUUID().slice(0, 12)}` };
  },
};

export const demoMessaging: MessagingProvider = {
  id: "demo",
  name: "Demo SMS / WhatsApp",
  live: false,
  description: "Not connected. Messages are not sent.",
  async send() {
    return { providerMessageId: `demo_${randomUUID().slice(0, 12)}` };
  },
};
