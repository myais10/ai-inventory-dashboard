import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { DependencyBadge, ReliabilityBadge, SupplierTabs } from "@/components/app/supplier-tabs";
import { cn, fmtCurrency, fmtNumber, fmtPct } from "@/lib/utils";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  return (
    <div className="animate-fade-in">
      <PageHeader title="Suppliers" description={`${ws.suppliers.length} active suppliers · lead time, reliability and cost performance from your purchase order history`} />
      <SupplierTabs active="/suppliers" />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Supplier</Th>
              <Th align="right">SKUs</Th>
              <Th align="right">Avg lead time</Th>
              <Th>Reliability</Th>
              <Th align="right">Open POs</Th>
              <Th align="right">Delayed POs</Th>
              <Th align="right">Price change (6 mo)</Th>
              <Th align="right">12-mo spend</Th>
              <Th>Dependency</Th>
            </tr>
          </thead>
          <tbody>
            {ws.suppliers.map((s) => (
              <tr key={s.supplier.id} className="hover:bg-subtle">
                <Td>
                  <Link href={`/suppliers/${s.supplier.code.toLowerCase()}`} className="font-medium text-ink hover:text-brand-600">
                    {s.supplier.name}
                  </Link>
                  <div className="text-[11px] text-muted">{s.supplier.contactName}</div>
                </Td>
                <Td align="right">{s.skuCount}</Td>
                <Td align="right">
                  <span className={cn("font-medium", s.avgLeadTimeDays > s.quotedLeadTimeDays * 1.1 ? "text-red-600" : "text-ink")}>{fmtNumber(s.avgLeadTimeDays, 1)}d</span>
                  <div className="text-[11px] text-faint">quoted {s.quotedLeadTimeDays}d</div>
                </Td>
                <Td><ReliabilityBadge onTime={s.onTimeRate} /></Td>
                <Td align="right">{s.openPos}</Td>
                <Td align="right" className={cn(s.delayedPos > 0 && "font-semibold text-red-600")}>{s.delayedPos || "—"}</Td>
                <Td align="right" className={cn(s.priceChangePct > 0.05 ? "font-semibold text-red-600" : s.priceChangePct > 0.03 ? "text-amber-600" : "")}>
                  {fmtPct(s.priceChangePct, 1, true)}
                </Td>
                <Td align="right">{fmtCurrency(s.spend12m)}</Td>
                <Td>
                  <DependencyBadge level={s.dependency} />
                  <span className="ml-1.5 text-[11px] text-faint">{fmtPct(s.revenueShare)} rev</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
