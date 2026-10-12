import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Mail } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { Badge, Card, CardHeader, Table, Td, Th } from "@/components/ui";
import { DependencyBadge, ReliabilityBadge } from "@/components/app/supplier-tabs";
import { RiskBadge, StockStatusBadge } from "@/components/app/badges";
import { SimpleLineChart } from "@/components/charts/charts";
import { cn, fmtCurrency, fmtDate, fmtNumber, fmtPct } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Supplier ${(await params).code.toUpperCase()}` };
}

export default async function SupplierDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await requireSession();
  const ws = await getWorkspace(session);
  const s = ws.suppliers.find((x) => x.supplier.code.toLowerCase() === code.toLowerCase());
  if (!s) notFound();
  const products = ws.metrics.filter((m) => m.product.supplierId === s.supplier.id).sort((a, b) => b.sales12mRevenue - a.sales12mRevenue);
  const openPos = ws.dataset.purchaseOrders.filter((po) => po.supplierId === s.supplier.id && (po.status === "open" || po.status === "partial")).sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1));
  const name = new Map(ws.dataset.products.map((p) => [p.id, p]));

  return (
    <div className="animate-fade-in">
      <Link href="/suppliers" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Suppliers
      </Link>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">{s.supplier.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <span>{s.supplier.contactName}</span>
            <a href={`mailto:${s.supplier.email}`} className="inline-flex items-center gap-1 hover:text-brand-600">
              <Mail className="h-3.5 w-3.5" /> {s.supplier.email}
            </a>
            <span>{s.supplier.paymentTerms}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <ReliabilityBadge onTime={s.onTimeRate} />
          <DependencyBadge level={s.dependency} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        {[
          ["SKUs supplied", String(s.skuCount)],
          ["Avg lead time", `${fmtNumber(s.avgLeadTimeDays, 1)}d (quoted ${s.quotedLeadTimeDays}d)`],
          ["On-time delivery", fmtPct(s.onTimeRate)],
          ["Open POs", `${s.openPos} · ${fmtCurrency(s.openPoValue)}`],
          ["Cost change (6 mo)", fmtPct(s.priceChangePct, 1, true)],
          ["12-month spend", fmtCurrency(s.spend12m)],
        ].map(([l, v]) => (
          <div key={l} className="bg-white px-4 py-3">
            <div className="text-[11.5px] text-muted">{l}</div>
            <div className="tabular mt-1 text-[15px] font-semibold text-ink">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Products" description="Sorted by 12-month revenue" />
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th align="right">On hand</Th>
                <Th align="right">Sales / wk</Th>
                <Th>Risk</Th>
                <Th>Status</Th>
                <Th align="right">12-mo revenue</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((m) => (
                <tr key={m.product.id} className="hover:bg-subtle">
                  <Td className="max-w-[260px]">
                    <Link href={`/products/${encodeURIComponent(m.product.sku)}`} className="block truncate font-medium text-ink hover:text-brand-600">
                      {m.product.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted">{m.product.sku}</span>
                  </Td>
                  <Td align="right">{fmtNumber(m.onHand)}</Td>
                  <Td align="right">{fmtNumber(m.weeklyVelocity, 1)}</Td>
                  <Td><RiskBadge risk={m.stockoutRisk} /></Td>
                  <Td><StockStatusBadge status={m.status} /></Td>
                  <Td align="right">{fmtCurrency(m.sales12mRevenue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Actual lead time" description="Monthly average of received POs" />
            <div className="px-3 py-4">
              <SimpleLineChart data={s.leadTimeHistory} dataKey="days" suffix="d" />
            </div>
          </Card>
          <Card>
            <CardHeader title="Open purchase orders" />
            <ul className="divide-y divide-line/70 text-[13px]">
              {openPos.length === 0 && <li className="px-5 py-6 text-center text-muted">No open purchase orders</li>}
              {openPos.map((po) => {
                const overdue = po.expectedDate < ws.dataset.asOf;
                return (
                  <li key={po.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-medium text-ink">{po.poNumber}</span>
                      {overdue ? <Badge tone="red">Overdue</Badge> : <Badge tone="brand">Open</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {po.lines.map((l) => `${fmtNumber(l.qty)} × ${name.get(l.productId)?.sku}`).join(", ")}
                    </div>
                    <div className={cn("text-xs", overdue ? "font-medium text-red-600" : "text-muted")}>Expected {fmtDate(po.expectedDate, true)}</div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
