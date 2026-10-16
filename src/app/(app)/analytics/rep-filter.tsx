"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function RepFilter({ value, reps }: { value: string; reps: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <>
      <label htmlFor="rep-filter" className="sr-only">
        Rep
      </label>
      <select
        id="rep-filter"
        value={value}
        onChange={(e) => {
          const u = new URLSearchParams(sp);
          if (e.target.value) u.set("rep", e.target.value);
          else u.delete("rep");
          router.replace(`/analytics?${u}`);
        }}
        className="h-8 rounded-md border border-line-strong bg-white px-2 text-[13px]"
      >
        <option value="">Whole team</option>
        {reps.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </>
  );
}
