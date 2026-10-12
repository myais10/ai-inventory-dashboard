"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthState } from "../actions";
import { Field, FormAlert, Input, SubmitButton } from "@/components/app/form";

export default function SignupPage() {
  const [state, action] = useActionState<AuthState, FormData>(signupAction, {});
  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">7-day free trial · No credit card</div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your workspace</h1>
      <p className="mt-1.5 text-sm text-muted">Import your inventory and get your first recommendations in minutes.</p>
      <form action={action} className="mt-8 space-y-4" noValidate>
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
        <Field label="Full name" htmlFor="fullName" error={state.fieldErrors?.fullName}>
          <Input id="fullName" name="fullName" autoComplete="name" placeholder="John Carter" invalid={!!state.fieldErrors?.fullName} />
        </Field>
        <Field label="Company name" htmlFor="companyName" error={state.fieldErrors?.companyName}>
          <Input id="companyName" name="companyName" autoComplete="organization" placeholder="Northstar Industrial Supply" invalid={!!state.fieldErrors?.companyName} />
        </Field>
        <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" invalid={!!state.fieldErrors?.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" invalid={!!state.fieldErrors?.password} />
        </Field>
        <SubmitButton>Start free trial</SubmitButton>
        <p className="text-center text-xs text-faint">By continuing you agree to the Terms of Service and Privacy Policy.</p>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
