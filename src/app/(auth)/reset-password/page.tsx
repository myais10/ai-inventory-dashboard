"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type AuthState } from "../actions";
import { Field, FormAlert, Input, SubmitButton } from "@/components/app/form";

export default function ResetPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(resetPasswordAction, {});
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted">Use at least 8 characters.</p>
      <form action={action} className="mt-8 space-y-4" noValidate>
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        {state.message && (
          <FormAlert tone="success">
            {state.message}{" "}
            <Link href="/login" className="font-medium underline">
              Sign in
            </Link>
          </FormAlert>
        )}
        <Field label="New password" htmlFor="password" error={state.fieldErrors?.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!state.fieldErrors?.password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" invalid={!!state.fieldErrors?.confirm} />
        </Field>
        <SubmitButton>Update password</SubmitButton>
      </form>
    </div>
  );
}
