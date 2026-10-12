import { LinkTabs } from "@/components/ui";
import type { Workspace } from "@/lib/data";

const open = (s: string) => s === "new" || s === "in_review";

export function RecommendationTabs({ ws, active }: { ws: Workspace; active: string }) {
  const recs = ws.recommendations.filter((r) => open(r.status));
  return (
    <LinkTabs
      active={active}
      tabs={[
        { href: "/recommendations", label: "All", count: recs.length },
        { href: "/recommendations/reorder", label: "Reorder", count: ws.metrics.filter((m) => m.needsReorder).length },
        { href: "/recommendations/stockout-risk", label: "Stockout Risk", count: ws.metrics.filter((m) => m.stockoutRisk === "high" || m.stockoutRisk === "medium").length },
        { href: "/recommendations/excess", label: "Excess & Slow Stock", count: ws.metrics.filter((m) => ["excess", "slow", "dead"].includes(m.status)).length },
        { href: "/recommendations/lost-demand", label: "Lost Demand", count: ws.lostDemand.filter((l) => !l.stocked).length },
      ]}
    />
  );
}
