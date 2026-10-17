"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Field, Input, Select } from "@/components/app/form";
import type { ActionResult } from "../leads/actions";
import { addMemberAction, clearDataAction, removeMemberAction, resetDemoAction, updateMemberRoleAction, updateProfileAction, updateWorkspaceAction } from "./actions";

function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const exec = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast("success", r.message ?? "Saved");
        onOk?.();
      } else toast("error", r.error);
    });
  return { pending, exec };
}

const TZ = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export function WorkspaceForm({
  canEdit,
  initial,
}: {
  canEdit: boolean;
  initial: { name: string; timezone: string; icpIndustries: string; icpMinEmployees: number; icpMaxEmployees: number };
}) {
  const { pending, exec } = useAction();
  return (
    <form action={(fd) => exec(() => updateWorkspaceAction(Object.fromEntries(fd) as Record<string, string>))} className="space-y-3">
      <fieldset disabled={!canEdit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Workspace name" htmlFor="w-name">
            <Input id="w-name" name="name" defaultValue={initial.name} />
          </Field>
          <Field label="Reporting timezone" htmlFor="w-tz">
            <Select id="w-tz" name="timezone" defaultValue={initial.timezone}>
              {Array.from(new Set([initial.timezone, ...TZ])).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="ICP industries (comma-separated)" htmlFor="w-ind">
          <Input id="w-ind" name="icpIndustries" defaultValue={initial.icpIndustries} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ICP min employees" htmlFor="w-min">
            <Input id="w-min" name="icpMinEmployees" type="number" min={1} defaultValue={initial.icpMinEmployees} />
          </Field>
          <Field label="ICP max employees" htmlFor="w-max">
            <Input id="w-max" name="icpMaxEmployees" type="number" min={1} defaultValue={initial.icpMaxEmployees} />
          </Field>
        </div>
      </fieldset>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save workspace"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only managers can change these settings.</p>
      )}
    </form>
  );
}

export function MembersPanel({
  members,
  canEdit,
  selfId,
}: {
  members: { id: string; name: string; email: string; role: string; title: string | null }[];
  canEdit: boolean;
  selfId: string;
}) {
  const { pending, exec } = useAction();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  return (
    <>
      <ul className="divide-y divide-line/70">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink">
                {m.name} {m.id === selfId && <span className="text-xs font-normal text-muted">(you)</span>}
              </div>
              <div className="text-xs text-muted">
                {m.email}
                {m.title ? ` · ${m.title}` : ""}
              </div>
            </div>
            {canEdit && m.id !== selfId ? (
              <div className="flex items-center gap-2">
                <label htmlFor={`role-${m.id}`} className="sr-only">
                  Role for {m.name}
                </label>
                <select
                  id={`role-${m.id}`}
                  defaultValue={m.role}
                  disabled={pending}
                  onChange={(e) => exec(() => updateMemberRoleAction(m.id, e.target.value))}
                  className="h-8 rounded-md border border-line-strong bg-subtle px-2 text-[13px] text-ink"
                >
                  <option value="rep">Rep</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => setRemoving({ id: m.id, name: m.name })}>
                  Remove
                </Button>
              </div>
            ) : (
              <span className="text-xs capitalize text-muted">{m.role}</span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="mt-3">
          <Button onClick={() => setAdding(true)}>Add member</Button>
        </div>
      )}
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a team member"
        description="They sign in with this email and temporary password, then change it under Your profile."
      >
        <form
          action={(fd) =>
            exec(
              () => addMemberAction(Object.fromEntries(fd) as Record<string, string>),
              () => setAdding(false),
            )
          }
          className="space-y-3"
        >
          <Field label="Full name" htmlFor="m-name">
            <Input id="m-name" name="name" required data-autofocus />
          </Field>
          <Field label="Email" htmlFor="m-email">
            <Input id="m-email" name="email" type="email" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" htmlFor="m-role">
              <Select id="m-role" name="role" defaultValue="rep">
                <option value="rep">Rep</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </Select>
            </Field>
            <Field label="Title (optional)" htmlFor="m-title">
              <Input id="m-title" name="title" />
            </Field>
          </div>
          <Field label="Temporary password" htmlFor="m-pw">
            <Input id="m-pw" name="password" type="text" minLength={8} required autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              Add member
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="They lose access immediately. Their open leads and tasks become unassigned; their call history stays."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                removing &&
                exec(
                  () => removeMemberAction(removing.id),
                  () => setRemoving(null),
                )
              }
              data-autofocus
            >
              Remove
            </Button>
          </>
        }
      >
        <span className="sr-only">Confirm removal</span>
      </Dialog>
    </>
  );
}

export function DataPanel({ canEdit }: { canEdit: boolean }) {
  const { pending, exec } = useAction();
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);
  if (!canEdit) return <p className="text-[13px] text-muted">Only the workspace owner can reset or clear data.</p>;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirm("reset")} disabled={pending}>
          Regenerate demo data
        </Button>
        <Button variant="danger" onClick={() => setConfirm("clear")} disabled={pending}>
          Delete all sales data
        </Button>
      </div>
      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "reset" ? "Regenerate demo data?" : "Delete all sales data?"}
        description={
          confirm === "reset"
            ? "Replaces every lead, company, call, task and deal with a fresh simulated history assigned to your reps. Users and stages are kept."
            : "Permanently deletes every lead, company, contact, call, task, meeting and deal. Users and stages are kept. This cannot be undone."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm === "clear" ? "danger" : "primary"}
              disabled={pending}
              data-autofocus
              onClick={() =>
                exec(
                  () => (confirm === "reset" ? resetDemoAction() : clearDataAction()),
                  () => setConfirm(null),
                )
              }
            >
              {pending ? "Working…" : confirm === "reset" ? "Regenerate" : "Delete everything"}
            </Button>
          </>
        }
      >
        <span className="sr-only">Confirm</span>
      </Dialog>
    </>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const { pending, exec } = useAction();
  return (
    <form action={(fd) => exec(() => updateProfileAction(Object.fromEntries(fd) as Record<string, string>))} className="space-y-3">
      <Field label="Name" htmlFor="p-name">
        <Input id="p-name" name="name" defaultValue={name} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Current password" htmlFor="p-cur">
          <Input id="p-cur" name="currentPassword" type="password" autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="p-new">
          <Input id="p-new" name="newPassword" type="password" autoComplete="new-password" minLength={8} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
