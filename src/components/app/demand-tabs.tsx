import { LinkTabs } from "@/components/ui";

export function DemandTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { href: "/demand/forecast", label: "Demand Forecast" },
        { href: "/demand/trends", label: "Demand Trends" },
        { href: "/demand/lost-demand", label: "Lost Demand" },
      ]}
    />
  );
}
