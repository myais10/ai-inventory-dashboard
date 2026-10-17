import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { isManager, requireSession } from "@/lib/auth/session";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/domain/dispositions";
import { SOURCES } from "@/lib/domain/scoring";
import { ctxOf, listCampaigns, listMembers } from "@/lib/services/context";
import { listLeads, type LeadFilters } from "@/lib/services/leads";
import { PageHeader, Tabs, buttonClass } from "@/components/ui";
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
    <div className="px-4 py-5 sm:px-6">
      <PageHeader title="Leads" description={activeView.hint} className="mb-3" />
      <div className="mb-3">
        <Tabs label="Lead views" tabs={VIEWS.map((v) => ({ href: href({ view: v.key || undefined }), label: v.label, active: v.key === (filters.view ?? "") }))} />
      </div>

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
              <Link className={buttonClass("secondary", "md")} href={href({ page: String(result.page - 1) })}>
                Previous
              </Link>
            )}
            {result.page < result.pages && (
              <Link className={buttonClass("secondary", "md")} href={href({ page: String(result.page + 1) })}>
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
