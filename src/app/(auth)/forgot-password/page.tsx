"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type AuthState } from "../actions";
import { Field, FormAlert, Input, SubmitButton } from "@/components/app/form";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(forgotPasswordAction, {});
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted">Enter your work email and we&apos;ll send you a reset link.</p>
      <form action={action} className="mt-8 space-y-4" noValidate>
        {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
        <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" invalid={!!state.fieldErrors?.email} />
        </Field>
        <SubmitButton>Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
