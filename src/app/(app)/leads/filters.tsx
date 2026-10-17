"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { LEAD_STATUSES } from "@/lib/domain/dispositions";
import { SOURCES } from "@/lib/domain/scoring";
import { useShortcuts } from "@/components/app/shortcuts";
import { cn } from "@/lib/utils";

const OPEN = "new,attempting,connected,qualified,nurture";

interface Values {
  q: string;
  owner: string;
  status: string;
  campaign: string;
  source: string;
  sort: string;
  view: string;
}

const selectCls = "h-8 rounded-md border border-line-strong bg-subtle px-2 text-[13px] text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

export function LeadFiltersBar({
  values,
  members,
  campaigns,
  isManager,
}: {
  values: Values;
  members: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  isManager: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(values.q);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  useShortcuts([{ keys: "f", label: "Filter / search leads", run: () => searchRef.current?.focus() }], []);

  const apply = (patch: Partial<Values>) => {
    const next = { ...values, q, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (q === values.q) return;
    const t = setTimeout(() => apply({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div role="search" className={cn("mb-3 flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-70")}>
      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
        <label htmlFor="lead-search" className="sr-only">
          Search leads
        </label>
        <input
          ref={searchRef}
          id="lead-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), q && setQ(""))}
          placeholder="Name, company, title, city, phone…"
          className="h-8 w-full rounded-md border border-line-strong bg-subtle pl-8 pr-7 text-[13px] text-ink outline-none placeholder:text-faint focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink" aria-label="Clear search">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <label className="sr-only" htmlFor="f-owner">
        Owner
      </label>
      <select id="f-owner" className={selectCls} value={values.owner} onChange={(e) => apply({ owner: e.target.value })}>
        <option value="me">My leads</option>
        <option value="all">Everyone&apos;s leads</option>
        <option value="unassigned">Unassigned</option>
        {isManager && (
          <optgroup label="Rep">
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <label className="sr-only" htmlFor="f-status">
        Status
      </label>
      <select id="f-status" className={selectCls} value={values.status} onChange={(e) => apply({ status: e.target.value })}>
        <option value="">Any status</option>
        <option value={OPEN}>Open (workable)</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-campaign">
        Campaign
      </label>
      <select id="f-campaign" className={cn(selectCls, "max-w-[200px]")} value={values.campaign} onChange={(e) => apply({ campaign: e.target.value })}>
        <option value="">All campaigns</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-source">
        Source
      </label>
      <select id="f-source" className={selectCls} value={values.source} onChange={(e) => apply({ source: e.target.value })}>
        <option value="">Any source</option>
        {Object.entries(SOURCES).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
      <div className="ml-auto flex items-center gap-1.5">
        <label htmlFor="f-sort" className="text-xs text-muted">
          Sort
        </label>
        <select id="f-sort" className={selectCls} value={values.sort} onChange={(e) => apply({ sort: e.target.value })}>
          <option value="score">Score</option>
          <option value="next_action">Next action due</option>
          <option value="last_contacted">Last contacted</option>
          <option value="created">Newest</option>
          <option value="name">Name</option>
          <option value="company">Company</option>
        </select>
      </div>
    </div>
  );
}
