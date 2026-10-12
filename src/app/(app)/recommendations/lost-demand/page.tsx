import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { RecommendationTabs } from "@/components/app/rec-tabs";
import { LostDemandSummary, LostDemandTable } from "@/components/app/lost-demand-table";

export const metadata: Metadata = { title: "Lost Demand" };

export default async function LostDemandRecsPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  return (
    <div className="animate-fade-in">
      <PageHeader title="Lost demand" description="Products customers repeatedly ask for that you don't stock — or couldn't supply." />
      <RecommendationTabs ws={ws} active="/recommendations/lost-demand" />
      <LostDemandSummary items={ws.lostDemand} />
      <LostDemandTable items={ws.lostDemand} recs={ws.recommendations} />
    </div>
  );
}
