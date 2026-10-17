"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export function CompanyFilters({ q, industry, industries }: { q: string; industry: string; industries: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState(q);
  const go = (patch: { q?: string; industry?: string }) => {
    const p = new URLSearchParams();
    const next = { q: term, industry, ...patch };
    if (next.q) p.set("q", next.q);
    if (next.industry) p.set("industry", next.industry);
    router.replace(`${pathname}?${p}`, { scroll: false });
  };
  useEffect(() => {
    if (term === q) return;
    const t = setTimeout(() => go({ q: term }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);
  return (
    <div role="search" className="mb-3 flex flex-wrap gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
        <label htmlFor="co-search" className="sr-only">
          Search companies
        </label>
        <input
          id="co-search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Company, city or domain…"
          className="h-8 w-full rounded-md border border-line-strong bg-subtle text-ink pl-8 pr-2 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
        />
      </div>
      <label htmlFor="co-industry" className="sr-only">
        Industry
      </label>
      <select
        id="co-industry"
        value={industry}
        onChange={(e) => go({ industry: e.target.value })}
        className="h-8 rounded-md border border-line-strong bg-subtle px-2 text-[13px] text-ink"
      >
        <option value="">All industries</option>
        {industries.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </div>
  );
}
