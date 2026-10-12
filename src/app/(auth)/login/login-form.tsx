"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";
import { Field, FormAlert, Input, SubmitButton } from "@/components/app/form";

export function LoginForm({ next, demoMode, linkError }: { next?: string; demoMode: boolean; linkError?: boolean }) {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {linkError && <FormAlert tone="error">That link has expired or is invalid. Please sign in or request a new link.</FormAlert>}
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" defaultValue={demoMode ? "demo@northstarsupply.com" : undefined} invalid={!!state.fieldErrors?.email} required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={state.fieldErrors?.password}
        hint={
          <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        }
      >
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" defaultValue={demoMode ? "northstar-demo" : undefined} invalid={!!state.fieldErrors?.password} required />
      </Field>
      <SubmitButton>Sign in</SubmitButton>
      {demoMode && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
          <span className="font-semibold">Demo mode:</span> Supabase isn&apos;t configured, so any email and password opens the Northstar Industrial Supply sample workspace.
        </p>
      )}
    </form>
  );
}
