export async function createSupabaseServerClient(): Promise<never> {
  throw new Error("Supabase is not available in the browser demo build.");
}
