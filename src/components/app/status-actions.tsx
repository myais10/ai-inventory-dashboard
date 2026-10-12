"use client";

import { useState, useTransition } from "react";
import { Check, Clock, Loader2, X } from "lucide-react";
import { updateRecommendationStatusAction } from "@/app/(app)/actions";
import type { RecommendationStatus } from "@/lib/types";
import { buttonClass } from "@/components/ui";
import { RecStatusBadge } from "./badges";

export function StatusActions({
  id,
  status,
  canEdit,
  onChange,
  size = "md",
}: {
  id: string;
  status: RecommendationStatus;
  canEdit: boolean;
  onChange?: (s: RecommendationStatus) => void;
  size?: "sm" | "md";
}) {
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<RecommendationStatus>();

  const set = (s: RecommendationStatus) =>
    start(async () => {
      setTarget(s);
      setError(undefined);
      const prev = current;
      setCurrent(s);
      onChange?.(s);
      const res = await updateRecommendationStatusAction(id, s);
      if (!res.ok) {
        setCurrent(prev);
        onChange?.(prev);
        setError(res.error);
      }
    });

  if (!canEdit) return <div className="text-xs text-muted">Status: <RecStatusBadge status={current} /> · View-only access</div>;

  const spin = (s: RecommendationStatus) => (pending && target === s ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || current === "approved"} onClick={() => set("approved")} className={buttonClass("primary", size)}>
          {spin("approved") ?? <Check className="h-3.5 w-3.5" />} {current === "approved" ? "Approved" : "Approve"}
        </button>
        <button type="button" disabled={pending || current === "in_review"} onClick={() => set("in_review")} className={buttonClass("secondary", size)}>
          {spin("in_review") ?? <Clock className="h-3.5 w-3.5" />} Mark in review
        </button>
        <button type="button" disabled={pending || current === "dismissed"} onClick={() => set("dismissed")} className={buttonClass("ghost", size)}>
          {spin("dismissed") ?? <X className="h-3.5 w-3.5" />} Dismiss
        </button>
        {current !== "new" && (
          <span className="ml-1 text-xs text-muted">
            Status: <RecStatusBadge status={current} />
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
