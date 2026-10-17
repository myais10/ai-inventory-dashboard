"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession, startSession } from "@/lib/auth/session";
import { ctxOf, listMyWorkspaces } from "@/lib/services/context";
import { searchEverything } from "@/lib/services/leads";

export async function searchAction(q: string) {
  const session = await requireSession();
  return searchEverything(ctxOf(session), String(q).slice(0, 100));
}

/** Switches the active workspace — only to one the user is actually a member of. */
export async function switchWorkspaceAction(orgId: string) {
  const session = await requireSession();
  const id = z.string().uuid().parse(orgId);
  const mine = await listMyWorkspaces(session.user.id);
  if (!mine.some((w) => w.id === id)) return { ok: false as const, error: "You are not a member of that workspace" };
  await startSession(session.user.id, id);
  redirect("/");
}
