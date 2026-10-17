"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { assignLeadsAction } from "../leads/actions";

export function AssignInline({ leadId, reps }: { leadId: string; reps: { id: string; name: string }[] }) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <label htmlFor={`as-${leadId}`} className="sr-only">
        Assign to
      </label>
      <select id={`as-${leadId}`} value={to} onChange={(e) => setTo(e.target.value)} className="h-7 flex-1 rounded-md border border-line-strong bg-subtle px-1.5 text-xs text-ink">
        <option value="">Assign to…</option>
        {reps.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="primary"
        disabled={!to || pending}
        onClick={() =>
          start(async () => {
            const r = await assignLeadsAction([leadId], to);
            if (r.ok) toast("success", `Assigned to ${reps.find((x) => x.id === to)?.name}`);
            else toast("error", r.error);
          })
        }
      >
        Assign
      </Button>
    </div>
  );
}
