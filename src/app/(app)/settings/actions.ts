"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ctxOf } from "@/lib/services/context";
import { userMessage } from "@/lib/services/errors";
import { addMember, clearWorkspaceData, removeMember, resetWorkspaceDemoData, updateMember, updateProfile, updateWorkspace } from "@/lib/services/settings";
import type { ActionResult } from "../leads/actions";

async function run(fn: () => Promise<unknown>, message: string | ((r: unknown) => string)): Promise<ActionResult> {
  try {
    const r = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message: typeof message === "function" ? message(r) : message };
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
}

function firstIssue(e: z.ZodError) {
  const i = e.issues[0];
  return `${String(i.path[0] ?? "")} ${i.message}`.trim();
}

const role = z.enum(["owner", "manager", "rep"]);

export async function updateWorkspaceAction(input: Record<string, string>) {
  const session = await requireSession();
  const p = z
    .object({
      name: z.string().trim().min(2).max(120),
      timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), "is not a known timezone"),
      icpIndustries: z.string().transform((v) => v.split(",").map((x) => x.trim()).filter(Boolean)),
      icpMinEmployees: z.coerce.number().int().min(1).max(1_000_000),
      icpMaxEmployees: z.coerce.number().int().min(1).max(1_000_000),
    })
    .safeParse(input);
  if (!p.success) return { ok: false as const, error: firstIssue(p.error) };
  return run(() => updateWorkspace(ctxOf(session), p.data), (n) => (n ? `Saved — ${n} leads rescored against the new ICP` : "Workspace saved"));
}

export async function addMemberAction(input: Record<string, string>) {
  const session = await requireSession();
  const p = z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email(),
      role,
      title: z.string().trim().max(80).transform((v) => v || null),
      password: z.string().min(8, "must be at least 8 characters").max(128),
    })
    .safeParse(input);
  if (!p.success) return { ok: false as const, error: firstIssue(p.error) };
  return run(() => addMember(ctxOf(session), p.data), (r) => ((r as { existing: boolean }).existing ? "Existing user added to the workspace" : `${p.data.name} added — share their temporary password`));
}

export async function updateMemberRoleAction(userId: string, newRole: string) {
  const session = await requireSession();
  return run(() => updateMember(ctxOf(session), z.string().uuid().parse(userId), { role: role.parse(newRole) }), "Role updated");
}

export async function removeMemberAction(userId: string) {
  const session = await requireSession();
  return run(() => removeMember(ctxOf(session), z.string().uuid().parse(userId)), "Member removed — their open leads are now unassigned");
}

export async function updateProfileAction(input: Record<string, string>) {
  const session = await requireSession();
  const p = z
    .object({
      name: z.string().trim().min(2).max(80),
      currentPassword: z.string().optional(),
      newPassword: z
        .string()
        .optional()
        .refine((v) => !v || v.length >= 8, "must be at least 8 characters"),
    })
    .safeParse(input);
  if (!p.success) return { ok: false as const, error: firstIssue(p.error) };
  return run(() => updateProfile(ctxOf(session), p.data), "Profile saved");
}

export async function resetDemoAction() {
  const session = await requireSession();
  return run(() => resetWorkspaceDemoData(ctxOf(session)), "Demo data regenerated");
}

export async function clearDataAction() {
  const session = await requireSession();
  return run(() => clearWorkspaceData(ctxOf(session)), "All leads, calls and deals deleted");
}
