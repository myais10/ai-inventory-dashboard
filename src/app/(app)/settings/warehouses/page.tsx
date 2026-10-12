import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { SettingsTabs } from "@/components/app/settings-tabs";
import { fmtCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Warehouses" };

export default async function WarehousesPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your workspace, team and data." />
      <SettingsTabs active="/settings/warehouses" />
      <Card>
        <CardHeader title="Warehouses" description="Stocking locations detected from your data. Recommendations are calculated per SKU and location." />
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Location</Th>
              <Th align="right">SKUs</Th>
              <Th align="right">Inventory value</Th>
              <Th align="right">At-risk SKUs</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {ws.dataset.warehouses.map((w) => {
              const h = ws.health.byWarehouse.find((x) => x.warehouseId === w.id);
              return (
                <tr key={w.id}>
                  <Td className="font-mono text-[12px] text-ink">{w.code}</Td>
                  <Td className="font-medium text-ink">{w.name}</Td>
                  <Td>{[w.city, w.state].filter(Boolean).join(", ") || "—"}</Td>
                  <Td align="right">{h?.skus ?? 0}</Td>
                  <Td align="right">{fmtCurrency(h?.value ?? 0)}</Td>
                  <Td align="right">{h?.atRisk ?? 0}</Td>
                  <Td>
                    <Badge tone="green" dot>
                      Active
                    </Badge>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
