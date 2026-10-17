import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Globe, MapPin, Phone } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { ctxOf } from "@/lib/services/context";
import { getCompany } from "@/lib/services/companies";
import { ScoreBadge, StatusBadge } from "@/components/app/lead-badges";
import { Timeline } from "@/components/app/timeline";
import { Badge } from "@/components/ui";
import { fmtMoney, fmtPhone, fmtRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getCompany(ctxOf(session), id);
  if (!data) notFound();
  const { company: co, people, deals, timeline } = data;
  const tz = session.org.timezone;
  const icp = co.industry ? session.org.icpIndustries.includes(co.industry) : false;
  const openValue = deals.filter((d) => d.stage.kind === "open").reduce((a, d) => a + d.deal.value, 0);

  return (
    <div className="px-4 py-5 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-2 text-xs text-faint">
        <Link href="/companies" className="hover:text-ink">
          Companies
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-muted">{co.name}</span>
      </nav>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">{co.name}</h1>
          {icp && <Badge tone="brand">ICP fit</Badge>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
          <span>{[co.industry, co.employeeCount && `${co.employeeCount.toLocaleString()} employees`, co.annualRevenue && `${fmtMoney(co.annualRevenue, true)} revenue`].filter(Boolean).join(" · ")}</span>
          <span className="inline-flex items-center gap-1 text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {co.city}, {co.state}
          </span>
          {co.domain && (
            <a href={`https://${co.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-brand-200">
              <Globe className="h-3.5 w-3.5" aria-hidden /> {co.domain}
            </a>
          )}
          {co.phone && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Phone className="h-3.5 w-3.5" aria-hidden /> {fmtPhone(co.phone)}
            </span>
          )}
        </p>
        {co.description && <p className="mt-2 max-w-3xl text-[13px] text-muted">{co.description}</p>}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 rounded-lg border border-line bg-surface shadow-card">
          <header className="border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">Account activity</h2>
          </header>
          <Timeline items={timeline.map((t) => ({ ...t, leadName: `${t.first} ${t.last}`, leadId: t.a.leadId }))} tz={tz} showLead />
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-line bg-surface shadow-card">
            <header className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">People ({people.length})</h2>
            </header>
            <ul className="divide-y divide-line/70">
              {people.map(({ lead, contact, owner }) => (
                <li key={lead.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/leads/${lead.id}`} className="text-[13px] font-medium text-ink hover:text-brand-200">
                        {contact.firstName} {contact.lastName}
                      </Link>
                      <div className="truncate text-xs text-muted">{contact.title}</div>
                    </div>
                    <ScoreBadge score={lead.score} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusBadge status={lead.status} />
                    <span>{owner ?? "Unassigned"}</span>
                    <span suppressHydrationWarning>· {lead.lastContactedAt ? `last call ${fmtRelative(lead.lastContactedAt)}` : "never called"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-line bg-surface shadow-card">
            <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Deals</h2>
              {openValue > 0 && <span className="tabular text-xs font-medium text-ink">{fmtMoney(openValue)} open</span>}
            </header>
            {deals.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-muted">No deals yet. A deal opens automatically when a meeting is booked.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {deals.map(({ deal, stage, owner }) => (
                  <li key={deal.id} className="px-4 py-3">
                    <Link href={`/pipeline/${deal.id}`} className="text-[13px] font-medium text-ink hover:text-brand-200">
                      {deal.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Badge tone={stage.kind === "won" ? "green" : stage.kind === "lost" ? "red" : "violet"}>{stage.name}</Badge>
                      <span className="tabular">{fmtMoney(deal.value)}</span>
                      <span>· {owner}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
