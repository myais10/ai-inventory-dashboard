"use server";

import { userMessage } from "@/lib/services/errors";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { LEAD_STATUSES } from "@/lib/domain/dispositions";
import { ctxOf, isManagerRole } from "@/lib/services/context";
import { addNote, assignLeads, setLeadStatus, updateContactForLead } from "@/lib/services/leads";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
}

const uuid = z.string().uuid();
const statusSchema = z.enum(LEAD_STATUSES.map((s) => s.key) as [string, ...string[]]);

export async function assignLeadsAction(leadIds: string[], ownerId: string | null): Promise<ActionResult> {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const ids = z.array(uuid).min(1).max(500).parse(leadIds);
  const owner = ownerId === null ? null : uuid.parse(ownerId);
  // Reps may only claim leads for themselves; managers assign freely.
  if (!isManagerRole(ctx.role) && owner !== ctx.userId) return { ok: false, error: "Only managers can assign leads to others" };
  return run(async () => {
    const n = await assignLeads(ctx, ids, owner);
    return `${n} lead${n === 1 ? "" : "s"} ${owner ? "assigned" : "unassigned"}`;
  });
}

export async function setLeadStatusAction(leadId: string, status: string, reason?: string): Promise<ActionResult> {
  const session = await requireSession();
  const id = uuid.parse(leadId);
  const st = statusSchema.parse(status) as (typeof LEAD_STATUSES)[number]["key"];
  return run(() => setLeadStatus(ctxOf(session), id, st, reason?.slice(0, 200)));
}

export async function addNoteAction(leadId: string, body: string): Promise<ActionResult> {
  const session = await requireSession();
  const text = z.string().trim().min(1, "Write something first").max(5000).safeParse(body);
  if (!text.success) return { ok: false, error: text.error.issues[0].message };
  return run(() => addNote(ctxOf(session), uuid.parse(leadId), text.data));
}

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .transform((v) => (v === "" ? null : v.startsWith("+") ? v : v.length === 10 ? `+1${v}` : v.length === 11 && v.startsWith("1") ? `+${v}` : v))
  .refine((v) => v === null || /^\+\d{8,15}$/.test(v), "Enter a valid phone number");

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  title: z.string().trim().max(120).transform((v) => v || null),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).transform((v) => v || null),
  phone,
  mobile: phone,
  timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC", "Unknown timezone"),
});

export async function updateContactAction(leadId: string, input: Record<string, string>): Promise<ActionResult & { fieldErrors?: Record<string, string> }> {
  const session = await requireSession();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Check the highlighted fields", fieldErrors };
  }
  return run(() => updateContactForLead(ctxOf(session), uuid.parse(leadId), parsed.data));
}
