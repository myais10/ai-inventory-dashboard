import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui";
import { SupplierTabs } from "@/components/app/supplier-tabs";
import { Sparkline } from "@/components/charts/sparkline";
import { cn, fmtNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Lead Times" };

export default async function LeadTimesPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const sorted = [...ws.suppliers].sort((a, b) => b.avgLeadTimeDays / b.quotedLeadTimeDays - a.avgLeadTimeDays / a.quotedLeadTimeDays);
  const maxLt = Math.max(...ws.suppliers.map((s) => Math.max(s.avgLeadTimeDays, s.quotedLeadTimeDays)));
  const stretched = ws.metrics.filter((m) => m.effectiveLeadTimeDays > m.product.leadTimeDays);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Lead times" description="Quoted versus actual lead times. Reorder calculations use whichever is longer, so plans reflect how suppliers really perform." />
      <SupplierTabs active="/suppliers/lead-times" />
      <Card>
        <CardHeader title="Quoted vs actual lead time" description="Bars show actual average; the marker shows the quoted lead time" />
        <Table>
          <thead>
            <tr>
              <Th>Supplier</Th>
              <Th className="w-[40%]">Lead time</Th>
              <Th align="right">Quoted</Th>
              <Th align="right">Actual avg</Th>
              <Th align="right">Variance</Th>
              <Th>6-month trend</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const variance = s.avgLeadTimeDays - s.quotedLeadTimeDays;
              return (
                <tr key={s.supplier.id} className="hover:bg-subtle">
                  <Td className="font-medium text-ink">
                    <Link href={`/suppliers/${s.supplier.code.toLowerCase()}`} className="hover:text-brand-600">
                      {s.supplier.name}
                    </Link>
                  </Td>
                  <Td>
                    <div className="relative h-2.5 rounded-full bg-slate-100">
                      <div className={cn("absolute inset-y-0 left-0 rounded-full", variance > 1.5 ? "bg-red-400" : "bg-brand-500")} style={{ width: `${(s.avgLeadTimeDays / maxLt) * 100}%` }} />
                      <div className="absolute -top-1 h-4.5 w-0.5 bg-ink" style={{ left: `${(s.quotedLeadTimeDays / maxLt) * 100}%`, height: 18 }} title="Quoted" />
                    </div>
                  </Td>
                  <Td align="right">{s.quotedLeadTimeDays}d</Td>
                  <Td align="right" className="font-medium text-ink">{fmtNumber(s.avgLeadTimeDays, 1)}d</Td>
                  <Td align="right" className={cn(variance > 1.5 ? "font-semibold text-red-600" : variance < -0.5 ? "text-emerald-600" : "text-muted")}>
                    {variance > 0 ? "+" : ""}
                    {fmtNumber(variance, 1)}d
                  </Td>
                  <Td>
                    <Sparkline values={s.leadTimeHistory.map((h) => h.days)} width={90} height={24} className={variance > 1.5 ? "text-red-500" : "text-brand-500"} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader title={`${stretched.length} SKUs planned with extended lead times`} description="Recent supplier performance is slower than quoted, so the engine uses the observed lead time" />
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Supplier</Th>
              <Th align="right">Quoted</Th>
              <Th align="right">Planning lead time</Th>
              <Th align="right">Extra safety needed</Th>
            </tr>
          </thead>
          <tbody>
            {stretched.slice(0, 25).map((m) => (
              <tr key={m.product.id} className="hover:bg-subtle">
                <Td>
                  <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="font-medium text-ink hover:text-brand-600">
                    {m.product.name}
                  </Link>
                </Td>
                <Td className="text-[12.5px]">{m.supplier.name}</Td>
                <Td align="right">{m.product.leadTimeDays}d</Td>
                <Td align="right" className="font-medium text-red-600">{m.effectiveLeadTimeDays}d</Td>
                <Td align="right">{fmtNumber(((m.effectiveLeadTimeDays - m.product.leadTimeDays) * m.forecastWeekly) / 7)} units</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
