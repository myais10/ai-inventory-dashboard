import { LinkTabs } from "@/components/ui";

export function SettingsTabs({ active }: { active: string }) {
  return (
    <LinkTabs
      active={active}
      tabs={[
        { href: "/settings/company", label: "Company" },
        { href: "/settings/users", label: "Users & Permissions" },
        { href: "/settings/data-sources", label: "Data Sources" },
        { href: "/settings/warehouses", label: "Warehouses" },
        { href: "/settings/billing", label: "Billing" },
        { href: "/settings/profile", label: "Profile" },
      ]}
    />
  );
}
