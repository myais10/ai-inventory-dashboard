"use server";

import { userMessage } from "@/lib/services/errors";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getDb, schema as s } from "@/lib/db";
import { DISPOSITION_KEYS } from "@/lib/domain/dispositions";
import { parseLocalInput } from "@/lib/domain/time";
import { endCall, logCallOutcome, startCall } from "@/lib/services/calls";
import { ctxOf } from "@/lib/services/context";
import { getQueue } from "@/lib/services/desk";
import { UserError } from "@/lib/services/errors";

const uuid = z.string().uuid();

function err(e: unknown) {
  return { ok: false as const, error: userMessage(e) };
}

export async function startCallAction(leadId: string, number: "phone" | "mobile") {
  const session = await requireSession();
  try {
    const r = await startCall(ctxOf(session), uuid.parse(leadId), number === "mobile" ? "mobile" : "phone");
    return { ok: true as const, callId: r.callId, startedAt: r.startedAt.toISOString(), provider: r.provider };
  } catch (e) {
    return err(e);
  }
}

export async function endCallAction(callId: string) {
  const session = await requireSession();
  try {
    const c = await endCall(ctxOf(session), uuid.parse(callId));
    return { ok: true as const, durationSec: c.durationSec ?? 0 };
  } catch (e) {
    return err(e);
  }
}

const logSchema = z.object({
  leadId: uuid,
  callId: uuid.nullable().optional(),
  disposition: z.enum(DISPOSITION_KEYS),
  notes: z.string().max(5000).optional(),
  callbackLocal: z.string().optional(),
  meetingLocal: z.string().optional(),
  reason: z.string().max(120).optional(),
  campaignId: z.string().optional(),
  skip: z.array(uuid).max(200).optional(),
});

/** Logs the outcome, then returns the next best lead so the desk can advance immediately. */
export async function logCallAction(input: z.input<typeof logSchema>) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const p = logSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: p.error.issues[0].message };
  const d = p.data;
  try {
    // Callback / meeting times are entered in the contact's local time.
    const db = await getDb();
    const [c] = await db
      .select({ tz: s.contacts.timezone })
      .from(s.leads)
      .innerJoin(s.contacts, eq(s.contacts.id, s.leads.contactId))
      .where(and(eq(s.leads.orgId, ctx.orgId), eq(s.leads.id, d.leadId)));
    if (!c) throw new UserError("Lead not found");
    const callbackAt = d.disposition === "callback" && d.callbackLocal ? parseLocalInput(d.callbackLocal, c.tz) : null;
    const meetingAt = d.disposition === "meeting_booked" && d.meetingLocal ? parseLocalInput(d.meetingLocal, c.tz) : null;
    const result = await logCallOutcome(ctx, {
      leadId: d.leadId,
      callId: d.callId ?? null,
      disposition: d.disposition,
      notes: d.notes?.trim() || null,
      callbackAt,
      meetingAt,
      reason: d.reason || null,
    });
    const queue = await getQueue(ctx, { campaignId: d.campaignId || undefined, skip: [...(d.skip ?? []), d.leadId] });
    const next = queue.due.find((r) => r.callableNow) ?? queue.due[0] ?? null;
    revalidatePath("/", "layout");
    return { ok: true as const, ...result, nextActionAt: result.nextActionAt?.toISOString() ?? null, nextLeadId: next?.lead.id ?? null, nextLeadName: next ? `${next.lead.firstName} ${next.lead.lastName}` : null };
  } catch (e) {
    return err(e);
  }
}
