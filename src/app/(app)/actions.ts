"use server";

import { requireSession } from "@/lib/auth/session";
import { ctxOf } from "@/lib/services/context";
import { searchEverything } from "@/lib/services/leads";

export async function searchAction(q: string) {
  const session = await requireSession();
  return searchEverything(ctxOf(session), String(q).slice(0, 100));
}
