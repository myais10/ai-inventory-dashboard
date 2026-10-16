// Provider contracts for external services. The app only talks to these interfaces; each has a
// demo implementation so every workflow is fully usable before credentials exist. A real
// integration (Twilio, SendGrid, Anthropic, Clearbit, Google Calendar…) implements the same
// interface and is selected with the matching *_PROVIDER env var in ./index.ts.

export interface ProviderInfo {
  id: string;
  name: string;
  /** false = demo/simulated: the UI must say so instead of implying a real action happened. */
  live: boolean;
  description: string;
}

// ---------- Phone ----------

export interface PlaceCallInput {
  callId: string;
  to: string;
  fromUserId: string;
}

export interface PlaceCallResult {
  providerCallId: string;
  status: "ringing" | "in_progress" | "failed";
  error?: string;
}

export interface PhoneProvider extends ProviderInfo {
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
  hangup(providerCallId: string): Promise<void>;
  /** Recording URL once available, if the provider records calls. */
  getRecordingUrl(providerCallId: string): Promise<string | null>;
}

// ---------- Email ----------

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  fromUserId: string;
}

export interface EmailProvider extends ProviderInfo {
  send(input: SendEmailInput): Promise<{ providerMessageId: string; delivered: boolean }>;
}

// ---------- AI ----------

export interface CallPrepInput {
  sellerName: string;
  contactName: string;
  title: string | null;
  companyName: string | null;
  industry: string | null;
  employeeCount: number | null;
  city: string | null;
  lastNotes: string[];
  lastDisposition: string | null;
  attemptCount: number;
  source: string;
}

export interface CallPrep {
  opener: string;
  talkingPoints: string[];
  likelyObjection: { objection: string; response: string } | null;
}

export interface AIProvider extends ProviderInfo {
  callPrep(input: CallPrepInput): Promise<CallPrep>;
}

// ---------- Enrichment ----------

export interface EnrichmentResult {
  employeeCount?: number;
  annualRevenue?: number;
  industry?: string;
  linkedinUrl?: string;
  mobile?: string;
}

export interface EnrichmentProvider extends ProviderInfo {
  enrichContact(input: { email: string | null; name: string; companyDomain: string | null }): Promise<EnrichmentResult | null>;
}

// ---------- Calendar ----------

export interface CalendarProvider extends ProviderInfo {
  createEvent(input: { title: string; start: Date; durationMin: number; attendeeEmail: string | null; organizerUserId: string }): Promise<{ externalId: string }>;
}

// ---------- Messaging (SMS / WhatsApp) ----------

export interface MessagingProvider extends ProviderInfo {
  send(input: { to: string; body: string; channel: "sms" | "whatsapp" }): Promise<{ providerMessageId: string }>;
}
