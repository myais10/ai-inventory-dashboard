"use client";

import { useActionState } from "react";
import { createCompanyAction } from "./actions";
import { Field, FormAlert, Input, SubmitButton } from "@/components/app/form";
import { Logo } from "@/components/app/logo";

export function CreateCompany() {
  const [state, action] = useActionState(createCompanyAction, {});
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold text-ink">Create your company workspace</h1>
        <p className="mt-1 text-sm text-muted">Your data is isolated to this workspace. You&apos;ll be its owner.</p>
        <form action={action} className="mt-6 space-y-4">
          {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
          <Field label="Company name" htmlFor="companyName">
            <Input id="companyName" name="companyName" required />
          </Field>
          <SubmitButton>Create workspace</SubmitButton>
        </form>
      </div>
    </div>
  );
}
