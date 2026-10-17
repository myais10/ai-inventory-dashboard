import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { DEMO_ACCOUNTS, DEMO_ORG, DEMO_PASSWORD } from "@/lib/db/seed";
import { FormAlert } from "@/components/app/form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const SEATS = DEMO_ACCOUNTS.filter((a) => ["jordan", "dana", "sam", "priya"].some((n) => a.email.startsWith(n)));

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; ended?: string }> }) {
  const { next, ended } = await searchParams;
  // Only offer one-click demo seats when the demo workspace actually exists in this database.
  const db = await getDb();
  const present = await db.select({ email: schema.users.email }).from(schema.users).where(inArray(schema.users.email, SEATS.map((a) => a.email)));
  const seats = SEATS.filter((a) => present.some((p) => p.email === a.email));
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted">
        New to Phoonica?{" "}
        <Link href="/signup" className="font-medium text-brand-300 hover:underline">
          Create a workspace
        </Link>
      </p>
      {ended && (
        <div className="mt-6">
          <FormAlert tone="error">Your access to that workspace has ended. Sign in again, or ask your workspace owner.</FormAlert>
        </div>
      )}
      <div className="mt-8">
        <LoginForm next={next} demo={seats.length ? { org: DEMO_ORG, password: DEMO_PASSWORD, accounts: seats } : null} />
      </div>
    </>
  );
}
