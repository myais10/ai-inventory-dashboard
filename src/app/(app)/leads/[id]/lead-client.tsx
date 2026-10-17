"use client";

import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Pencil, Phone } from "lucide-react";
import { Button, buttonClass } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Field, Input, Select } from "@/components/app/form";
import { Kbd, useShortcuts } from "@/components/app/shortcuts";
import { LEAD_STATUSES, NOT_INTERESTED_REASONS, type LeadStatus } from "@/lib/domain/dispositions";
import { addNoteAction, assignLeadsAction, setLeadStatusAction, updateContactAction } from "../actions";

const US_TZ = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];

export function LeadActions({
  leadId,
  status,
  ownerId,
  userId,
  canWork,
  isManager,
  members,
  callable,
  contact,
}: {
  leadId: string;
  status: LeadStatus;
  ownerId: string | null;
  userId: string;
  canWork: boolean;
  isManager: boolean;
  members: { id: string; name: string }[];
  callable: boolean;
  contact: { firstName: string; lastName: string; title: string | null; email: string | null; phone: string | null; mobile: string | null; timezone: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useShortcuts(
    [
      ...(callable && canWork ? [{ keys: "c", label: "Call this lead", run: () => router.push(`/desk?lead=${leadId}`) }] : []),
      ...(canWork ? [{ keys: "e", label: "Edit contact details", run: () => setEditOpen(true) }] : []),
    ],
    [callable, canWork, leadId],
  );

  const changeStatus = (next: LeadStatus, reason?: string) =>
    start(async () => {
      const r = await setLeadStatusAction(leadId, next, reason);
      if (r.ok) toast("success", `Status set to ${LEAD_STATUSES.find((s) => s.key === next)!.label}`);
      else toast("error", r.error);
      setReasonOpen(false);
    });

  const assign = (owner: string) =>
    start(async () => {
      const r = await assignLeadsAction([leadId], owner === "__none" ? null : owner);
      if (r.ok) toast("success", r.message ?? "Updated");
      else toast("error", r.error);
    });

  const saveContact = (fd: FormData) =>
    start(async () => {
      const r = await updateContactAction(leadId, Object.fromEntries(fd) as Record<string, string>);
      if (r.ok) {
        setEditOpen(false);
        setFieldErrors({});
        toast("success", "Contact updated");
      } else {
        setFieldErrors(("fieldErrors" in r && r.fieldErrors) || {});
        toast("error", r.error);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canWork && callable && (
        <Link href={`/desk?lead=${leadId}`} className={buttonClass("primary", "md")}>
          <Phone className="h-4 w-4" aria-hidden /> Call <Kbd keys="c" className="text-white/70" />
        </Link>
      )}
      {canWork && (
        <>
          <label htmlFor="lead-status" className="sr-only">
            Lead status
          </label>
          <select
            id="lead-status"
            value={status}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value as LeadStatus;
              if (v === "unqualified") setReasonOpen(true);
              else changeStatus(v);
            }}
            className="h-8 rounded-md border border-line-strong bg-subtle px-2.5 text-[13px] text-ink"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        </>
      )}
      {isManager ? (
        <>
          <label htmlFor="lead-owner" className="sr-only">
            Owner
          </label>
          <select
            id="lead-owner"
            value={ownerId ?? "__none"}
            disabled={pending}
            onChange={(e) => assign(e.target.value)}
            className="h-8 rounded-md border border-line-strong bg-subtle px-2.5 text-[13px] text-ink"
          >
            <option value="__none">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </>
      ) : (
        !ownerId && (
          <Button onClick={() => assign(userId)} disabled={pending}>
            Claim lead
          </Button>
        )
      )}

      <Dialog open={reasonOpen} onClose={() => setReasonOpen(false)} title="Why is this lead unqualified?" description="The reason feeds win/loss reporting and removes the lead from every queue.">
        <div className="grid grid-cols-2 gap-2">
          {[...NOT_INTERESTED_REASONS, "Not a fit (ICP)", "Duplicate"].map((r, i) => (
            <Button key={r} onClick={() => changeStatus("unqualified", r)} disabled={pending} data-autofocus={i === 0 ? true : undefined}>
              {r}
            </Button>
          ))}
        </div>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit contact" description="Fixing a wrong number puts the lead back in the calling queue.">
        <form action={saveContact} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="c-first" error={fieldErrors.firstName}>
              <Input id="c-first" name="firstName" defaultValue={contact.firstName} invalid={!!fieldErrors.firstName} data-autofocus />
            </Field>
            <Field label="Last name" htmlFor="c-last" error={fieldErrors.lastName}>
              <Input id="c-last" name="lastName" defaultValue={contact.lastName} invalid={!!fieldErrors.lastName} />
            </Field>
          </div>
          <Field label="Title" htmlFor="c-title">
            <Input id="c-title" name="title" defaultValue={contact.title ?? ""} />
          </Field>
          <Field label="Email" htmlFor="c-email" error={fieldErrors.email}>
            <Input id="c-email" name="email" type="email" defaultValue={contact.email ?? ""} invalid={!!fieldErrors.email} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Direct phone" htmlFor="c-phone" error={fieldErrors.phone}>
              <Input id="c-phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} invalid={!!fieldErrors.phone} />
            </Field>
            <Field label="Mobile" htmlFor="c-mobile" error={fieldErrors.mobile}>
              <Input id="c-mobile" name="mobile" type="tel" defaultValue={contact.mobile ?? ""} invalid={!!fieldErrors.mobile} />
            </Field>
          </div>
          <Field label="Timezone" htmlFor="c-tz" error={fieldErrors.timezone}>
            <Select id="c-tz" name="timezone" defaultValue={contact.timezone}>
              {Array.from(new Set([contact.timezone, ...US_TZ])).map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save contact"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function NoteComposer({ leadId }: { leadId: string }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  useShortcuts([{ keys: "n", label: "Write a note", run: () => ref.current?.focus() }], []);

  const save = () =>
    start(async () => {
      const r = await addNoteAction(leadId, body);
      if (r.ok) {
        setBody("");
        toast("success", "Note added to timeline");
      } else toast("error", r.error);
    });

  return (
    <div className="border-b border-line px-4 py-3">
      <label htmlFor="note" className="sr-only">
        Add a note
      </label>
      <textarea
        ref={ref}
        id="note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        rows={2}
        placeholder="Add a note — research, context, anything the next person should know…"
        className="w-full resize-y rounded-md border border-line-strong bg-subtle px-3 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        <span className="text-xs text-faint">
          <Kbd keys="mod+enter" /> to save
        </span>
        <Button size="sm" variant="primary" onClick={save} disabled={!body.trim() || pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </div>
  );
}
