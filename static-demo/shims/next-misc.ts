import { refresh } from "./router";

// next/cache
export function revalidatePath() {
  setTimeout(refresh, 0);
}
export function revalidateTag() {}

// next/headers (only reached on Supabase code paths, which are disabled here)
export async function headers() {
  return new Map([["origin", location.origin]]);
}
export async function cookies() {
  return { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {} };
}

// next/server
export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), { ...init, headers: { "Content-Type": "application/json" } });
  }
}
