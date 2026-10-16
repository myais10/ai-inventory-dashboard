"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ctxOf } from "@/lib/services/context";
import { createDealFromLead, moveDealStage, setMeetingOutcome, updateDeal } from "@/lib/services/deals";
import { userMessage } from "@/lib/services/errors";
import type { ActionResult } from "../leads/actions";

const uuid = z.string().uuid();

async function run<T>(fn: () => Promise<T>, message?: (r: T) => string | undefined): Promise<ActionResult & { id?: string }> {
  try {
    const r = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message: message?.(r), id: (r as { id?: string } | undefined)?.id };
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
}

export async function moveDealAction(dealId: string, stageId: string, lostReason?: string) {
  const session = await requireSession();
  return run(
    () => moveDealStage(ctxOf(session), uuid.parse(dealId), uuid.parse(stageId), lostReason?.slice(0, 120)),
    (to) => (to ? `Moved to ${to.name}` : undefined),
  );
}

const dealSchema = z.object({
  name: z.string().trim().min(2).max(160),
  value: z.coerce.number().int().min(0).max(100_000_000),
  expectedCloseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .transform((v) => v || null),
  nextStep: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
});

export async function updateDealAction(dealId: string, input: Record<string, string>) {
  const session = await requireSession();
  const p = dealSchema.safeParse(input);
  if (!p.success) return { ok: false as const, error: `Check ${String(p.error.issues[0].path[0])}: ${p.error.issues[0].message}` };
  return run(() => updateDeal(ctxOf(session), uuid.parse(dealId), p.data), () => "Deal updated");
}

export async function createDealAction(leadId: string) {
  const session = await requireSession();
  return run(() => createDealFromLead(ctxOf(session), uuid.parse(leadId)), () => "Deal opened in the pipeline");
}

export async function meetingOutcomeAction(meetingId: string, outcome: string) {
  const session = await requireSession();
  const o = z.enum(["held", "no_show", "cancelled"]).parse(outcome);
  return run(
    () => setMeetingOutcome(ctxOf(session), uuid.parse(meetingId), o),
    () => (o === "held" ? "Meeting marked held" : "Reschedule task created"),
  );
}
