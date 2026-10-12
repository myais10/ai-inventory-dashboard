"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { inviteUserAction, updateCompanyAction, updateProfileAction } from "../actions";
import { Field, FormAlert, Input, Select, SubmitButton } from "@/components/app/form";

export function CompanyForm({ name, industry, currency, timezone, disabled }: { name: string; industry: string; currency: string; timezone: string; disabled: boolean }) {
  const [state, action] = useActionState(updateCompanyAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.ok && <FormAlert tone="success">Company settings saved.</FormAlert>}
      <fieldset disabled={disabled} className="space-y-4">
        <Field label="Company name" htmlFor="name">
          <Input id="name" name="name" defaultValue={name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Industry" htmlFor="industry">
            <Input id="industry" name="industry" defaultValue={industry} />
          </Field>
          <Field label="Currency" htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={currency}>
              {["USD", "CAD", "EUR", "GBP", "AUD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Timezone" htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue={timezone}>
              {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Australia/Sydney"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-40">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </fieldset>
      {disabled && <p className="text-xs text-muted">Only owners and admins can change company settings.</p>}
    </form>
  );
}

export function InviteForm({ disabled, onInvited }: { disabled: boolean; onInvited?: (email: string, role: string) => void }) {
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof inviteUserAction>>, fd: FormData) => {
    const res = await inviteUserAction(prev, fd);
    if (res.ok && res.email) onInvited?.(res.email, res.role!);
    return res;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <fieldset disabled={disabled} className="contents">
        <div className="flex-1">
          <Field label="Email address" htmlFor="invite-email">
            <Input id="invite-email" name="email" type="email" placeholder="colleague@company.com" required />
          </Field>
        </div>
        <div className="sm:w-40">
          <Field label="Role" htmlFor="invite-role">
            <Select id="invite-role" name="role" defaultValue="manager">
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </Select>
          </Field>
        </div>
        <div className="sm:w-36">
          <SubmitButton>Send invite</SubmitButton>
        </div>
      </fieldset>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function TeamManager({ members, canManage }: { members: { name: string; email: string; role: string; status: string; lastActive: string }[]; canManage: boolean }) {
  const [list, setList] = useState(members);
  const [flash, setFlash] = useState<string>();
  return (
    <div>
      <div className="border-b border-line px-5 py-4">
        <InviteForm
          disabled={!canManage}
          onInvited={(email, role) => {
            setList((l) => [...l, { name: email.split("@")[0], email, role, status: "Invited", lastActive: "—" }]);
            setFlash(`Invitation sent to ${email}`);
          }}
        />
        {flash && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {flash}
          </p>
        )}
        {!canManage && <p className="mt-2 text-xs text-muted">Only owners and admins can invite users.</p>}
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="bg-subtle px-5 py-2 font-medium">User</th>
              <th className="bg-subtle px-3 py-2 font-medium">Role</th>
              <th className="bg-subtle px-3 py-2 font-medium">Status</th>
              <th className="bg-subtle px-5 py-2 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.email} className="border-t border-line/70">
                <td className="px-5 py-2.5">
                  <div className="font-medium capitalize text-ink">{m.name}</div>
                  <div className="text-xs text-muted">{m.email}</div>
                </td>
                <td className="px-3 py-2.5 capitalize text-ink-2">{m.role}</td>
                <td className="px-3 py-2.5">
                  <span className={m.status === "Active" ? "text-emerald-700" : "text-amber-700"}>{m.status}</span>
                </td>
                <td className="px-5 py-2.5 text-muted">{m.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.ok && <FormAlert tone="success">Profile updated.</FormAlert>}
      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" defaultValue={fullName} required />
      </Field>
      <Field label="Job title" htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" placeholder="Purchasing Manager" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" value={email} disabled readOnly />
      </Field>
      <div className="w-40">
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </form>
  );
}
