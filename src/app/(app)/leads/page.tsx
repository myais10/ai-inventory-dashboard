import type { Metadata } from "next";
import Link from "next/link";
import { isManager, requireSession } from "@/lib/auth/session";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/domain/dispositions";
import { SOURCES } from "@/lib/domain/scoring";
import { ctxOf, listCampaigns, listMembers } from "@/lib/services/context";
import { listLeads, type LeadFilters } from "@/lib/services/leads";
import { cn } from "@/lib/utils";
import { LeadFiltersBar } from "./filters";
import { LeadTable } from "./lead-table";

export const metadata: Metadata = { title: "Leads" };

const VIEWS = [
  { key: "", label: "All", hint: "Every lead matching your filters, best score first." },
  { key: "due", label: "Due now", hint: "Leads whose next action is due — this is what the Calling Desk works through." },
  { key: "callbacks", label: "Callbacks", hint: "Contacts who asked you to call back. Keep these promises first." },
  { key: "hot", label: "Hot", hint: "Score 60+: strong ICP fit and/or real engagement." },
  { key: "untouched", label: "Never contacted", hint: "No attempts yet. Fresh imports and new inbound leads." },
] as const;

type SP = Record<string, string | undefined>;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const sp = await searchParams;
  const manager = isManager(session);
  const filters: LeadFilters = {
    q: sp.q,
    view: (VIEWS.some((v) => v.key === sp.view) ? sp.view : undefined) as LeadFilters["view"],
    owner: sp.owner ?? (manager ? "all" : "me"),
    status: sp.status ? (sp.status.split(",").filter((x) => LEAD_STATUSES.some((s) => s.key === x)) as LeadStatus[]) : undefined,
    campaign: sp.campaign || undefined,
    source: sp.source && SOURCES[sp.source] ? sp.source : undefined,
    minScore: sp.minScore ? Number(sp.minScore) || undefined : undefined,
    sort: (["score", "last_contacted", "next_action", "created", "name", "company"].includes(sp.sort ?? "") ? sp.sort : "score") as LeadFilters["sort"],
    page: Number(sp.page) || 1,
  };
  const [result, members, campaigns] = await Promise.all([listLeads(ctx, filters), listMembers(ctx), listCampaigns(ctx)]);
  const activeView = VIEWS.find((v) => v.key === (filters.view ?? ""))!;

  const href = (patch: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Leads</h1>
          <p className="mt-0.5 text-sm text-muted">{activeView.hint}</p>
        </div>
      </div>

      <nav aria-label="Lead views" className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {VIEWS.map((v) => {
          const active = v.key === (filters.view ?? "");
          return (
            <Link
              key={v.key}
              href={href({ view: v.key || undefined })}
              aria-current={active ? "page" : undefined}
              className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium", active ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink")}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>

      <LeadFiltersBar
        values={{ q: sp.q ?? "", owner: filters.owner!, status: sp.status ?? "", campaign: sp.campaign ?? "", source: sp.source ?? "", sort: filters.sort!, view: sp.view ?? "" }}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
        isManager={manager}
      />

      <LeadTable
        rows={result.rows}
        total={result.total}
        tz={session.org.timezone}
        canAssign={manager}
        members={members.filter((m) => m.role === "rep" || m.role === "manager").map((m) => ({ id: m.id, name: m.name }))}
        emptyHint={filters.q ? `No leads match “${filters.q}”.` : "No leads match these filters."}
      />

      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-[13px] text-muted">
          <span>
            Page {result.page} of {result.pages}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link className="rounded-md border border-line bg-white px-3 py-1.5 font-medium text-ink-2 hover:bg-subtle" href={href({ page: String(result.page - 1) })}>
                Previous
              </Link>
            )}
            {result.page < result.pages && (
              <Link className="rounded-md border border-line bg-white px-3 py-1.5 font-medium text-ink-2 hover:bg-subtle" href={href({ page: String(result.page + 1) })}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
