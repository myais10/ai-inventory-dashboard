import { Badge, LinkTabs, type Tone } from "@/components/ui";
import type { SupplierMetrics } from "@/lib/types";
import { reliabilityLabel } from "@/lib/suppliers";
import { fmtPct } from "@/lib/utils";

export function SupplierTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { href: "/suppliers", label: "Suppliers" },
        { href: "/suppliers/performance", label: "Supplier Performance" },
        { href: "/suppliers/lead-times", label: "Lead Times" },
      ]}
    />
  );
}

export function ReliabilityBadge({ onTime }: { onTime: number }) {
  const r = reliabilityLabel(onTime);
  const tone: Tone = r.tone === "good" ? "green" : r.tone === "warn" ? "amber" : "red";
  return (
    <Badge tone={tone} dot>
      {fmtPct(onTime)} · {r.label}
    </Badge>
  );
}

export function DependencyBadge({ level }: { level: SupplierMetrics["dependency"] }) {
  const tone: Tone = level === "high" ? "red" : level === "medium" ? "amber" : "slate";
  return <Badge tone={tone}>{level[0].toUpperCase() + level.slice(1)}</Badge>;
}
