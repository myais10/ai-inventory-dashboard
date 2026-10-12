import Link from "next/link";
import type { Metadata } from "next";
import { Database, FileSpreadsheet, FileText, Plug, UploadCloud } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getWorkspace } from "@/lib/data";
import { tenant } from "@/lib/data/demo-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";
import { SettingsTabs } from "@/components/app/settings-tabs";
import { fmtDate, fmtNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Data Sources" };

export default async function DataSourcesPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  let imports = session.mode === "demo" ? tenant(session.company.id).imports : [];
  if (session.mode === "supabase") {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.from("data_imports").select("*").eq("company_id", session.company.id).order("created_at", { ascending: false }).limit(20);
    imports = (data ?? []).map((d) => ({
      id: d.id,
      fileName: d.file_name,
      createdAt: d.created_at,
      rows: d.row_count,
      imported: d.imported_count,
      errors: d.error_count,
      status: d.status === "completed" ? "completed" : "failed",
      kind: d.kind,
    }));
  }
  const canImport = can(session.role, "data:import");

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your workspace, team and data." />
      <SettingsTabs active="/settings/data-sources" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <FileText className="h-5 w-5 text-brand-600" />
          <div className="mt-3 text-sm font-semibold text-ink">CSV upload</div>
          <p className="mt-1 text-[13px] text-muted">Inventory, sales history, purchase orders and enquiries.</p>
          <Link href="/onboarding" className={buttonClass("primary", "sm", `mt-4 ${canImport ? "" : "pointer-events-none opacity-50"}`)}>
            <UploadCloud className="h-3.5 w-3.5" /> Import data
          </Link>
        </Card>
        <Card className="p-5">
          <FileSpreadsheet className="h-5 w-5 text-muted" />
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
            Excel upload <Badge>Coming soon</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted">Upload .xlsx workbooks directly. Save sheets as CSV in the meantime.</p>
        </Card>
        <Card className="p-5">
          <Plug className="h-5 w-5 text-muted" />
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
            ERP integrations <Badge>Coming soon</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted">Prophet 21, NetSuite, SAP Business One, Infor CSD, Dynamics 365 BC.</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Current dataset"
          description={ws.isSample ? "You're exploring the Northstar Industrial Supply sample dataset" : "Data imported by your team"}
          actions={ws.isSample ? <Badge tone="brand">Sample data</Badge> : <Badge tone="green">Live data</Badge>}
        />
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Products", ws.dataset.products.length],
            ["Warehouses", ws.dataset.warehouses.length],
            ["Suppliers", ws.dataset.suppliers.length],
            ["Sales weeks", ws.dataset.salesWeeks.filter((s) => s.qty > 0).length],
            ["Purchase orders", ws.dataset.purchaseOrders.length],
            ["Enquiries", ws.dataset.enquiries.length],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="text-xs text-muted">{l}</div>
              <div className="tabular text-lg font-semibold text-ink">{fmtNumber(v as number)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Import history" />
        {imports.length === 0 ? (
          <EmptyState icon={<Database className="h-4 w-4" />} title="No imports yet" description="Upload a CSV export from your ERP to replace the sample data with your own." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Files</Th>
                <Th>Type</Th>
                <Th>Date</Th>
                <Th align="right">Rows</Th>
                <Th align="right">Imported</Th>
                <Th align="right">Errors</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <Td className="max-w-[320px] truncate font-medium text-ink">{i.fileName}</Td>
                  <Td className="text-[12.5px]">{i.kind}</Td>
                  <Td className="tabular">{fmtDate(i.createdAt.slice(0, 10), true)}</Td>
                  <Td align="right">{fmtNumber(i.rows)}</Td>
                  <Td align="right">{fmtNumber(i.imported)}</Td>
                  <Td align="right">{fmtNumber(i.errors)}</Td>
                  <Td>{i.status === "completed" ? <Badge tone="green">Completed</Badge> : <Badge tone="red">Failed</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
