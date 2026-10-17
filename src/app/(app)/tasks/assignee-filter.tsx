"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function AssigneeFilter({ value, members }: { value: string; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <>
      <label htmlFor="assignee" className="sr-only">
        Assignee
      </label>
      <select
        id="assignee"
        value={value}
        onChange={(e) => {
          const u = new URLSearchParams(sp);
          u.set("assignee", e.target.value);
          router.replace(`/tasks?${u}`);
        }}
        className="h-9 rounded-lg border border-line-strong bg-subtle px-2.5 text-sm text-ink"
      >
        <option value="me">My tasks</option>
        <option value="all">Everyone</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </>
  );
}
