import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_ACCOUNTS, DEMO_ORG, DEMO_PASSWORD } from "@/lib/db/seed";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted">
        New to Phoonica?{" "}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">
          Create a workspace
        </Link>
      </p>
      <div className="mt-8">
        <LoginForm
          next={next}
          demo={{ org: DEMO_ORG, password: DEMO_PASSWORD, accounts: DEMO_ACCOUNTS.filter((a) => ["jordan", "dana", "sam", "priya"].some((n) => a.email.startsWith(n))) }}
        />
      </div>
    </>
  );
}
