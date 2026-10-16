"use server";

import { userMessage } from "@/lib/services/errors";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { parseLocalInput } from "@/lib/domain/time";
import { ctxOf } from "@/lib/services/context";
import { completeTask, createTask, reopenTask, rescheduleTask } from "@/lib/services/tasks";
import type { ActionResult } from "../leads/actions";

const uuid = z.string().uuid();

async function run(fn: () => Promise<unknown>, message?: string): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
}

export async function completeTaskAction(taskId: string): Promise<ActionResult> {
  const session = await requireSession();
  return run(() => completeTask(ctxOf(session), uuid.parse(taskId)), "Task completed");
}

export async function reopenTaskAction(taskId: string): Promise<ActionResult> {
  const session = await requireSession();
  return run(() => reopenTask(ctxOf(session), uuid.parse(taskId)), "Task reopened");
}

export async function rescheduleTaskAction(taskId: string, local: string): Promise<ActionResult> {
  const session = await requireSession();
  const due = parseLocalInput(local, session.org.timezone);
  if (!due) return { ok: false, error: "Pick a valid date and time" };
  return run(() => rescheduleTask(ctxOf(session), uuid.parse(taskId), due), "Task rescheduled");
}

const createSchema = z.object({
  title: z.string().trim().min(2, "Describe the task").max(200),
  type: z.enum(["call", "email", "follow_up", "meeting_prep", "other"]),
  due: z.string().min(1, "Pick a due date"),
  leadId: z.string().uuid().optional().or(z.literal("")),
  dealId: z.string().uuid().optional().or(z.literal("")),
  assigneeId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function createTaskAction(input: Record<string, string>): Promise<ActionResult> {
  const session = await requireSession();
  const p = createSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const due = parseLocalInput(p.data.due, session.org.timezone);
  if (!due) return { ok: false, error: "Pick a valid date and time" };
  return run(
    () =>
      createTask(ctxOf(session), {
        title: p.data.title,
        type: p.data.type,
        dueAt: due,
        leadId: p.data.leadId || null,
        dealId: p.data.dealId || null,
        assigneeId: p.data.assigneeId || null,
        notes: p.data.notes || null,
      }),
    "Task created",
  );
}
