import "server-only";
import { demoAI, demoCalendar, demoEmail, demoEnrichment, demoMessaging, demoPhone } from "./demo";
import type { AIProvider, CalendarProvider, EmailProvider, EnrichmentProvider, MessagingProvider, PhoneProvider, ProviderInfo } from "./types";

// Registry: add real implementations here keyed by id and select them with env vars, e.g.
// PHONE_PROVIDER=twilio → phone.twilio. Unknown ids fall back to demo so the app always works.
const phone: Record<string, PhoneProvider> = { demo: demoPhone };
const email: Record<string, EmailProvider> = { demo: demoEmail };
const ai: Record<string, AIProvider> = { demo: demoAI };
const enrichment: Record<string, EnrichmentProvider> = { demo: demoEnrichment };
const calendar: Record<string, CalendarProvider> = { demo: demoCalendar };
const messaging: Record<string, MessagingProvider> = { demo: demoMessaging };

const pick = <T,>(reg: Record<string, T>, key: string | undefined) => reg[key ?? "demo"] ?? reg.demo;

export const providers = {
  phone: () => pick(phone, process.env.PHONE_PROVIDER),
  email: () => pick(email, process.env.EMAIL_PROVIDER),
  ai: () => pick(ai, process.env.AI_PROVIDER),
  enrichment: () => pick(enrichment, process.env.ENRICHMENT_PROVIDER),
  calendar: () => pick(calendar, process.env.CALENDAR_PROVIDER),
  messaging: () => pick(messaging, process.env.MESSAGING_PROVIDER),
};

export function providerStatus(): { kind: string; info: ProviderInfo }[] {
  return [
    { kind: "Phone", info: providers.phone() },
    { kind: "Email", info: providers.email() },
    { kind: "AI", info: providers.ai() },
    { kind: "Enrichment", info: providers.enrichment() },
    { kind: "Calendar", info: providers.calendar() },
    { kind: "SMS / WhatsApp", info: providers.messaging() },
  ];
}
