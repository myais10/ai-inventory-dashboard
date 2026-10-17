import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { requireSession } from "@/lib/auth/session";
import { ctxOf } from "@/lib/services/context";
import { companyIndustries, listCompanies } from "@/lib/services/companies";
import { ScoreBadge } from "@/components/app/lead-badges";
import { Badge, PageHeader, buttonClass, thClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtMoney, fmtRelative } from "@/lib/format";
import { CompanyFilters } from "./filters";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const sp = await searchParams;
  const [res, industries] = await Promise.all([listCompanies(ctx, { q: sp.q, industry: sp.industry, page: Number(sp.page) || 1 }), companyIndustries(ctx)]);
  const icp = new Set(session.org.icpIndustries);
  const pageHref = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/companies?${u}`;
  };

  return (
    <div className="px-4 py-5 sm:px-6">
      <PageHeader title="Companies" description="Accounts with open pipeline first, then by their best lead's score." className="mb-3" />
      <div>
        <CompanyFilters q={sp.q ?? ""} industry={sp.industry ?? ""} industries={industries} />
      </div>
      <div className="relative overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">Companies</caption>
          <thead>
            <tr>
              <th scope="col" className={cn(thClass, "pl-4 pr-3")}>Company</th>
              <th scope="col" className={cn(thClass, "px-3")}>Industry</th>
              <th scope="col" className={cn(thClass, "hidden text-right md:table-cell")}>Employees</th>
              <th scope="col" className={cn(thClass, "px-3 text-right")}>Contacts</th>
              <th scope="col" className={cn(thClass, "px-3")}>Best lead</th>
              <th scope="col" className={cn(thClass, "px-3 text-right")}>Open pipeline</th>
              <th scope="col" className={cn(thClass, "hidden pr-4 lg:table-cell")}>Last touch</th>
            </tr>
          </thead>
          <tbody>
            {res.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center text-muted">
                  No companies match.
                </td>
              </tr>
            )}
            {res.rows.map((r) => (
              <tr key={r.company.id} className="border-b border-line/70 last:border-0 hover:bg-subtle">
                <td className="py-2 pl-4 pr-3">
                  <Link href={`/companies/${r.company.id}`} className="font-medium text-ink hover:text-brand-200">
                    {r.company.name}
                  </Link>
                  <span className="block text-xs text-muted">
                    {r.company.city}, {r.company.state}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-ink-2">{r.company.industry}</span>
                  {r.company.industry && icp.has(r.company.industry) && (
                    <Badge tone="brand" className="ml-1.5">
                      ICP
                    </Badge>
                  )}
                </td>
                <td className="tabular hidden px-3 py-2 text-right text-ink-2 md:table-cell">{r.company.employeeCount?.toLocaleString() ?? "—"}</td>
                <td className="tabular px-3 py-2 text-right text-ink-2">{r.leads ?? 0}</td>
                <td className="px-3 py-2">{r.best !== null ? <ScoreBadge score={r.best} /> : "—"}</td>
                <td className="tabular px-3 py-2 text-right">
                  {r.openValue ? <span className="font-medium text-ink">{fmtMoney(Number(r.openValue))}</span> : <span className="text-faint">—</span>}
                </td>
                <td className="hidden px-3 py-2 pr-4 text-xs text-muted lg:table-cell" suppressHydrationWarning>
                  {r.lastTouch ? fmtRelative(new Date(r.lastTouch)) : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-[13px] text-muted">
        <span>
          {res.total.toLocaleString()} companies · page {res.page} of {res.pages}
        </span>
        <div className="flex gap-2">
          {res.page > 1 && (
            <Link className={buttonClass("secondary", "md")} href={pageHref(res.page - 1)}>
              Previous
            </Link>
          )}
          {res.page < res.pages && (
            <Link className={buttonClass("secondary", "md")} href={pageHref(res.page + 1)}>
              Next
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
