"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Field, Input } from "@/components/app/form";
import { cn } from "@/lib/utils";
import { createDealAction, meetingOutcomeAction, moveDealAction, updateDealAction } from "../actions";
import { LostReasonDialog } from "../board";

export function StageStepper({ dealId, stageId, stages, canEdit }: { dealId: string; stageId: string; stages: { id: string; name: string; kind: string; probability: number }[]; canEdit: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [lostOpen, setLostOpen] = useState(false);
  const open = stages.filter((s) => s.kind === "open");
  const current = stages.find((s) => s.id === stageId)!;
  const idx = open.findIndex((s) => s.id === stageId);
  const won = stages.find((s) => s.kind === "won")!;
  const lost = stages.find((s) => s.kind === "lost")!;

  const move = (id: string, reason?: string) =>
    start(async () => {
      const r = await moveDealAction(dealId, id, reason);
      if (r.ok) toast("success", r.message ?? "Moved");
      else toast("error", r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ol className="flex flex-1 overflow-hidden rounded-lg border border-line bg-white" aria-label="Deal stage">
        {open.map((s, i) => {
          const done = current.kind === "won" || (idx >= 0 && i < idx);
          const active = s.id === stageId;
          return (
            <li key={s.id} className="min-w-0 flex-1 border-r border-line last:border-r-0">
              <button
                type="button"
                disabled={!canEdit || pending || active}
                onClick={() => move(s.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-1.5 truncate px-2 text-[12.5px] font-medium transition-colors",
                  active ? "bg-brand-700 text-white" : done ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-subtle",
                  canEdit && !active && "cursor-pointer",
                )}
              >
                {done && <Check className="h-3.5 w-3.5" aria-hidden />}
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {canEdit && (
        <div className="flex gap-2">
          <Button onClick={() => move(won.id)} disabled={pending || current.kind === "won"} className="border-emerald-600 text-emerald-700">
            Mark won
          </Button>
          <Button onClick={() => setLostOpen(true)} disabled={pending || current.kind === "lost"}>
            Mark lost
          </Button>
        </div>
      )}
      <LostReasonDialog
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        onPick={(r) => {
          setLostOpen(false);
          move(lost.id, r);
        }}
      />
    </div>
  );
}

export function DealForm({ dealId, initial, canEdit }: { dealId: string; initial: { name: string; value: number; expectedCloseDate: string | null; nextStep: string | null }; canEdit: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const save = (fd: FormData) =>
    start(async () => {
      const r = await updateDealAction(dealId, Object.fromEntries(fd) as Record<string, string>);
      if (r.ok) {
        setDirty(false);
        toast("success", "Deal updated");
      } else toast("error", r.error);
    });
  return (
    <form action={save} onChange={() => setDirty(true)} className="space-y-3 px-4 py-3">
      <fieldset disabled={!canEdit} className="space-y-3">
        <Field label="Deal name" htmlFor="d-name">
          <Input id="d-name" name="name" defaultValue={initial.name} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Annual value ($)" htmlFor="d-value">
            <Input id="d-value" name="value" type="number" min={0} step={500} defaultValue={initial.value} />
          </Field>
          <Field label="Expected close" htmlFor="d-close">
            <Input id="d-close" name="expectedCloseDate" type="date" defaultValue={initial.expectedCloseDate ?? ""} />
          </Field>
        </div>
        <Field label="Next step" htmlFor="d-next">
          <Input id="d-next" name="nextStep" defaultValue={initial.nextStep ?? ""} placeholder="What has to happen next?" />
        </Field>
      </fieldset>
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={!dirty || pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function MeetingOutcome({ meetingId }: { meetingId: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const set = (o: "held" | "no_show") =>
    start(async () => {
      const r = await meetingOutcomeAction(meetingId, o);
      if (r.ok) toast("success", r.message ?? "Saved");
      else toast("error", r.error);
    });
  return (
    <span className="flex gap-1.5">
      <Button size="sm" onClick={() => set("held")} disabled={pending}>
        Held
      </Button>
      <Button size="sm" onClick={() => set("no_show")} disabled={pending}>
        No-show
      </Button>
    </span>
  );
}

export function CreateDealButton({ leadId }: { leadId: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await createDealAction(leadId);
          if (r.ok) toast("success", r.message ?? "Deal opened");
          else toast("error", r.error);
        })
      }
    >
      Open deal
    </Button>
  );
}
