import Link from "next/link";
import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">Sign in to your inventory intelligence workspace.</p>
      <div className="mt-8">
        <LoginForm next={sp.next} demoMode={!isSupabaseConfigured()} linkError={sp.error === "link_expired"} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        New to Inventory Intelligence?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Start your 7-day free trial
        </Link>
      </p>
    </div>
  );
}
