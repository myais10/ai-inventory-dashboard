"use client";

import { useActionState, useRef } from "react";
import { loginAction, type AuthState } from "../actions";
import { Field, FormAlert, Input, SubmitButton } from "@/components/app/form";

interface DemoAccount {
  email: string;
  name: string;
  role: string;
  title: string;
}

export function LoginForm({ next, demo }: { next?: string; demo: { org: string; password: string; accounts: DemoAccount[] } }) {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  const signInAs = (a: DemoAccount) => {
    const f = formRef.current!;
    (f.elements.namedItem("email") as HTMLInputElement).value = a.email;
    (f.elements.namedItem("password") as HTMLInputElement).value = demo.password;
    f.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action={action} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
        <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" invalid={!!state.fieldErrors?.email} required />
        </Field>
        <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" invalid={!!state.fieldErrors?.password} required />
        </Field>
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <section aria-labelledby="demo-h" className="mt-8 rounded-lg border border-line p-4">
        <h2 id="demo-h" className="text-[13px] font-semibold text-ink">
          Explore the demo workspace
        </h2>
        <p className="mt-0.5 text-xs text-muted">{demo.org} — 6 weeks of real call activity. Pick a seat:</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {demo.accounts.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => signInAs(a)}
              className="rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
            >
              <span className="block text-[13px] font-medium text-ink">{a.name}</span>
              <span className="block text-[11px] text-muted">{a.title}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
