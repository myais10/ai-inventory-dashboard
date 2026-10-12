import type { Metadata } from "next";
import { Check } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, CardHeader, PageHeader, ProgressBar, buttonClass } from "@/components/ui";
import { SettingsTabs } from "@/components/app/settings-tabs";
import { cn, fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

// Plan catalog. Stripe price IDs get attached here when billing goes live
// (checkout session → webhook updates `subscriptions` with the service role).
const PLANS = [
  { id: "starter", name: "Starter", price: 499, desc: "For single-branch distributors", features: ["Up to 5,000 SKUs", "1 warehouse", "5 users", "CSV imports", "Weekly reports"] },
  { id: "growth", name: "Growth", price: 1290, desc: "For multi-branch distributors", features: ["Up to 50,000 SKUs", "Up to 10 warehouses", "25 users", "ERP integration", "Daily refresh", "Inventory assistant"], featured: true },
  { id: "enterprise", name: "Enterprise", price: null, desc: "For large catalogs & groups", features: ["Unlimited SKUs & warehouses", "SSO & audit exports", "Custom forecasting policies", "Dedicated success manager"] },
];

export default async function BillingPage() {
  const session = await requireSession();
  const c = session.company;
  const used = 7 - c.trialDaysRemaining;
  const canBill = can(session.role, "billing:manage");
  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your workspace, team and data." />
      <SettingsTabs active="/settings/billing" />
      <Card>
        <CardHeader title="Current plan" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-ink">Free trial</div>
            <div className="text-[13px] text-muted">
              Started {fmtDate(c.trialStart, true)} · ends {fmtDate(c.trialEnd, true)} · {c.trialDaysRemaining} days remaining
            </div>
            <ProgressBar value={used / 7} className="mt-3 w-72" />
          </div>
          <div className="text-xs text-muted">No credit card on file</div>
        </div>
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.id} className={cn("flex flex-col p-6", p.featured && "ring-2 ring-brand-500")}>
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-ink">{p.name}</div>
              {p.featured && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Most popular</span>}
            </div>
            <div className="mt-1 text-[13px] text-muted">{p.desc}</div>
            <div className="mt-4 text-3xl font-semibold tracking-tight text-ink">
              {p.price ? `$${p.price.toLocaleString()}` : "Custom"}
              {p.price && <span className="text-sm font-normal text-muted"> / month</span>}
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-[13px] text-ink-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" /> {f}
                </li>
              ))}
            </ul>
            <button type="button" disabled className={buttonClass(p.featured ? "primary" : "secondary", "md", "mt-6 w-full")} title="Online checkout launches soon">
              {p.price ? "Upgrade — coming soon" : "Contact sales"}
            </button>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        {canBill ? "Online checkout is being enabled. To continue after your trial, contact sales@inventoryintelligence.app." : "Only the workspace owner can manage billing."}
      </p>
    </div>
  );
}
