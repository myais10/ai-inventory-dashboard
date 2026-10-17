"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthState } from "../actions";
import { Field, FormAlert, Input, SubmitButton } from "@/components/app/form";

export default function SignupPage() {
  const [state, action] = useActionState<AuthState, FormData>(signupAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your workspace</h1>
      <p className="mt-1.5 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-300 hover:underline">
          Sign in
        </Link>
      </p>
      <form action={action} className="mt-8 space-y-4" noValidate>
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <Field label="Full name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" autoComplete="name" invalid={!!fe.name} required />
        </Field>
        <Field label="Company" htmlFor="orgName" error={fe.orgName}>
          <Input id="orgName" name="orgName" autoComplete="organization" invalid={!!fe.orgName} required />
        </Field>
        <Field label="Work email" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" autoComplete="email" invalid={!!fe.email} required />
        </Field>
        <Field label="Password" htmlFor="password" error={fe.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" invalid={!!fe.password} required />
        </Field>
        <label className="flex items-start gap-2.5 text-[13px] text-ink-2">
          <input type="checkbox" name="demo" defaultChecked className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span>
            Start with sample leads and call history
            <span className="block text-xs text-muted">You can clear it later from Settings.</span>
          </span>
        </label>
        <SubmitButton>Create workspace</SubmitButton>
      </form>
    </>
  );
}
