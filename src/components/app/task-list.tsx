"use client";

import Link from "@/components/ui/link";
import { useState, useTransition } from "react";
import { CalendarClock, Check, PhoneCall, Plus } from "lucide-react";
import { completeTaskAction, createTaskAction, reopenTaskAction, rescheduleTaskAction } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Field, Input, Select } from "@/components/app/form";
import { fmtDateTime, fmtRelative, toLocalInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TaskItemData {
  id: string;
  title: string;
  type: string;
  dueAt: Date;
  completedAt: Date | null;
  notes?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  companyName?: string | null;
  dealName?: string | null;
  assignee?: string | null;
}

const TYPE_LABEL: Record<string, string> = { call: "Call", callback: "Callback", email: "Email", follow_up: "Follow-up", meeting_prep: "Meeting prep", other: "To-do" };

export function TaskItem({ t, tz, showLead, showAssignee }: { t: TaskItemData; tz: string; showLead?: boolean; showAssignee?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [due, setDue] = useState(() => toLocalInput(t.dueAt, tz));
  const now = new Date();
  const overdue = !t.completedAt && t.dueAt < now;
  const isCall = t.type === "callback" || t.type === "call" || (t.type === "follow_up" && !t.dealName);

  const toggle = () =>
    start(async () => {
      const r = t.completedAt ? await reopenTaskAction(t.id) : await completeTaskAction(t.id);
      if (r.ok) toast("success", t.completedAt ? "Task reopened" : "Task completed");
      else toast("error", r.error);
    });
  const reschedule = () =>
    start(async () => {
      const r = await rescheduleTaskAction(t.id, due);
      if (r.ok) {
        setEditing(false);
        toast("success", "Task rescheduled");
      } else toast("error", r.error);
    });

  return (
    <li className={cn("flex items-start gap-3 px-4 py-3", pending && "opacity-60")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={!!t.completedAt}
        aria-label={t.completedAt ? `Reopen: ${t.title}` : `Complete: ${t.title}`}
        onClick={toggle}
        disabled={pending}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors",
          t.completedAt ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong hover:border-brand-500",
        )}
      >
        {t.completedAt && <Check className="h-3 w-3" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[13px] font-medium text-ink", t.completedAt && "text-muted line-through")}>{t.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span className="rounded bg-subtle px-1.5 py-px text-[11px] text-ink-2">{TYPE_LABEL[t.type] ?? t.type}</span>
          {showLead && t.leadId && (
            <Link href={`/leads/${t.leadId}`} className="font-medium text-ink-2 hover:text-brand-200 hover:underline">
              {t.leadName}
              {t.companyName ? ` · ${t.companyName}` : ""}
            </Link>
          )}
          {showLead && !t.leadId && t.dealName && <span>{t.dealName}</span>}
          {showAssignee && t.assignee && <span>· {t.assignee}</span>}
          {t.notes && <span className="truncate">· {t.notes}</span>}
        </div>
        {editing && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor={`due-${t.id}`} className="sr-only">
              New due date
            </label>
            <input
              id={`due-${t.id}`}
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-7 rounded-md border border-line-strong px-2 text-xs"
            />
            <Button size="sm" variant="primary" onClick={reschedule} disabled={pending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn("whitespace-nowrap text-xs", overdue ? "font-medium text-red-300" : "text-muted")} suppressHydrationWarning>
          {t.completedAt ? `Done ${fmtRelative(t.completedAt)}` : overdue ? `Overdue · ${fmtDateTime(t.dueAt, tz)}` : fmtDateTime(t.dueAt, tz, { weekday: true, date: true, time: true })}
        </span>
        {!t.completedAt && (
          <span className="flex items-center gap-1">
            {isCall && t.leadId && (
              <Link href={`/desk?lead=${t.leadId}`} className="rounded p-1 text-muted hover:bg-brand-50 hover:text-brand-200" aria-label={`Call ${t.leadName ?? "lead"} now`} title="Call now">
                <PhoneCall className="h-3.5 w-3.5" />
              </Link>
            )}
            <button type="button" onClick={() => setEditing((e) => !e)} className="rounded p-1 text-muted hover:bg-subtle hover:text-ink" aria-label="Reschedule" title="Reschedule">
              <CalendarClock className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

export function NewTaskButton({
  tz,
  leadId,
  dealId,
  members,
  defaultTitle = "",
  size = "sm",
}: {
  tz: string;
  leadId?: string;
  dealId?: string;
  members?: { id: string; name: string }[];
  defaultTitle?: string;
  size?: "sm" | "md";
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tomorrow9 = () => {
    const d = new Date(Date.now() + 86_400_000);
    return toLocalInput(d, tz).slice(0, 11) + "09:00";
  };

  const submit = (fd: FormData) =>
    start(async () => {
      const r = await createTaskAction({ ...(Object.fromEntries(fd) as Record<string, string>), leadId: leadId ?? "", dealId: dealId ?? "" });
      if (r.ok) {
        setOpen(false);
        setError(null);
        toast("success", "Task created");
      } else setError(r.error);
    });

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> Task
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New task" description="Tasks show up in Tasks and on the record they belong to.">
        <form action={submit} className="space-y-3">
          {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>}
          <Field label="What needs to happen?" htmlFor="t-title">
            <Input id="t-title" name="title" defaultValue={defaultTitle} required data-autofocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="t-type">
              <Select id="t-type" name="type" defaultValue="follow_up">
                <option value="follow_up">Follow-up</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting_prep">Meeting prep</option>
                <option value="other">To-do</option>
              </Select>
            </Field>
            <Field label="Due" htmlFor="t-due">
              <Input id="t-due" name="due" type="datetime-local" defaultValue={tomorrow9()} required />
            </Field>
          </div>
          {members && members.length > 0 && (
            <Field label="Assignee" htmlFor="t-assignee">
              <Select id="t-assignee" name="assigneeId" defaultValue="">
                <option value="">Me</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Notes (optional)" htmlFor="t-notes">
            <Input id="t-notes" name="notes" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Create task"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
