import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getWorkspace } from "@/lib/data";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/app/settings-tabs";
import { POLICY } from "@/lib/inventory";
import { fmtDate } from "@/lib/utils";
import { CompanyForm } from "../forms";

export const metadata: Metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  const session = await requireSession();
  const ws = await getWorkspace(session);
  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your workspace, team and data." />
      <SettingsTabs active="/settings/company" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Company" description="Workspace details visible to everyone in your company" />
          <div className="p-5">
            <CompanyForm
              name={session.company.name}
              industry={session.company.industry || ws.dataset.company.industry}
              currency={ws.dataset.company.currency}
              timezone={ws.dataset.company.timezone || "America/Chicago"}
              disabled={!can(session.role, "company:update")}
            />
          </div>
        </Card>
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Workspace" />
            <dl className="divide-y divide-line/70 text-[13px]">
              {[
                ["Workspace ID", session.company.id],
                ["Your role", session.role],
                ["Trial started", fmtDate(session.company.trialStart, true)],
                ["Trial ends", fmtDate(session.company.trialEnd, true)],
                ["Data source", ws.isSample ? "Sample data" : "Imported data"],
                ["Auth mode", session.mode === "demo" ? "Demo (no Supabase configured)" : "Supabase"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-5 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="truncate font-medium capitalize text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Planning policy" description="Defaults used by the recommendation engine" />
            <dl className="divide-y divide-line/70 text-[13px]">
              {[
                ["Service level", "95% (z = 1.65)"],
                ["Order cover after lead time", `${POLICY.reviewCoverDays} days`],
                ["Excess threshold", `${POLICY.excessCoverWeeks} weeks of cover`],
                ["Slow-moving after", `${POLICY.slowDaysSinceSale} days without sale`],
                ["Dead stock after", `${POLICY.deadDaysSinceSale} days without sale`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-5 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
