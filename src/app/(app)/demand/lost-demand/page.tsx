import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { DemandTabs } from "@/components/app/demand-tabs";
import { LostDemandSummary, LostDemandTable } from "@/components/app/lost-demand-table";

export const metadata: Metadata = { title: "Lost Demand" };

export default async function DemandLostPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  return (
    <div className="animate-fade-in">
      <PageHeader title="Demand" description="Customer requests you couldn't fulfil — the demand your sales history doesn't show." />
      <DemandTabs active="/demand/lost-demand" />
      <LostDemandSummary items={ws.lostDemand} />
      <LostDemandTable items={ws.lostDemand} recs={ws.recommendations} />
    </div>
  );
}
