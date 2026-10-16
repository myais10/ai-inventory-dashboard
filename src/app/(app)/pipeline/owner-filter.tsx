"use client";

import { usePathname, useRouter } from "next/navigation";

export function OwnerFilter({ value, members }: { value: string; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="owner-filter" className="text-xs text-muted">
        Owner
      </label>
      <select id="owner-filter" value={value} onChange={(e) => router.replace(`${pathname}?owner=${e.target.value}`, { scroll: false })} className="h-8 rounded-md border border-line-strong bg-white px-2 text-[13px]">
        <option value="me">My deals</option>
        <option value="all">Everyone</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
