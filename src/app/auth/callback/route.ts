import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles Supabase email confirmation and password-recovery links (PKCE code exchange).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (isSupabaseConfigured() && code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First confirmation after signup: make sure the user's company exists.
      const { data: { user } } = await supabase.auth.getUser();
      const companyName = user?.user_metadata?.company_name as string | undefined;
      if (user && companyName) {
        const { count } = await supabase.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", user.id);
        if (!count) await supabase.rpc("create_company_for_current_user", { company_name: companyName });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
