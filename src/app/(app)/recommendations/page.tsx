import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getWorkspace } from "@/lib/data";
import { recommendationTableProps } from "@/lib/data/views";
import { TYPE_META } from "@/lib/recommendations";
import type { RecommendationType } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { RecommendationsTable } from "@/components/app/recommendations-table";
import { RecommendationTabs } from "@/components/app/rec-tabs";
import { fmtCompactCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Recommendations" };

export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<{ type?: string; priority?: string; status?: string }> }) {
  const sp = await searchParams;
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const props = recommendationTableProps(ws);
  const open = ws.recommendations.filter((r) => r.status === "new" || r.status === "in_review");

  return (
    <div className="animate-fade-in">
      <PageHeader title="Recommendations" description="Prioritised actions calculated from your inventory, sales, purchasing and supplier data." />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(TYPE_META) as RecommendationType[]).map((t) => {
          const list = open.filter((r) => r.type === t);
          return (
            <div key={t} className="rounded-lg border border-line bg-white px-4 py-3">
              <div className="text-xs text-muted">{TYPE_META[t].label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="tabular text-xl font-semibold text-ink">{list.length}</span>
                <span className="tabular text-xs text-muted">{fmtCompactCurrency(list.reduce((a, r) => a + r.impactValue, 0))}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-red-600">{list.filter((r) => r.priority === "high").length} high priority</div>
            </div>
          );
        })}
      </div>
      <RecommendationTabs ws={ws} active="/recommendations" />
      <RecommendationsTable {...props} canEdit={can(session.role, "recommendations:update")} initial={{ type: sp.type, priority: sp.priority, status: sp.status }} />
    </div>
  );
}
