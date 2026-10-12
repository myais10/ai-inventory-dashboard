import { requireSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data";
import { AppShell } from "@/components/app/shell";
import type { NotificationItem, SearchItem } from "@/components/app/header";
import { NAV } from "@/components/app/nav";
import { TYPE_META } from "@/lib/recommendations";
import { fmtDate } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const ws = await getWorkspace(session);

  const open = ws.recommendations.filter((r) => r.status === "new" || r.status === "in_review");
  const badges = {
    openRecs: open.filter((r) => r.priority === "high").length,
    reorder: ws.metrics.filter((m) => m.needsReorder).length,
    stockout: ws.metrics.filter((m) => m.stockoutRisk === "high" || m.stockoutRisk === "medium").length,
  };

  const searchIndex: SearchItem[] = [
    ...NAV.flatMap((n) => (n.children ? n.children.map((c) => ({ type: "Page" as const, label: c.label, sub: n.label, href: c.href })) : [{ type: "Page" as const, label: n.label, href: n.href }])),
    ...ws.metrics.map((m) => ({ type: "Product" as const, label: m.product.name, sub: `${m.product.sku} · ${m.product.category}`, href: `/products/${encodeURIComponent(m.product.sku)}` })),
    ...ws.suppliers.map((s) => ({ type: "Supplier" as const, label: s.supplier.name, sub: `${s.skuCount} SKUs`, href: `/suppliers/${s.supplier.code.toLowerCase()}` })),
    ...ws.recommendations.map((r) => ({ type: "Recommendation" as const, label: r.title, sub: `${TYPE_META[r.type].label} · ${r.recommendation}`, href: `/recommendations/${r.id}` })),
  ];

  const notifications: NotificationItem[] = [
    ...ws.metrics
      .filter((m) => m.stockoutRisk === "high")
      .sort((a, b) => (a.daysUntilStockout ?? 0) - (b.daysUntilStockout ?? 0))
      .slice(0, 4)
      .map((m) => ({
        id: `n-so-${m.product.id}`,
        title: `${m.product.sku} stocks out ${fmtDate(m.projectedStockoutDate)}`,
        body: `${m.product.name} — ${m.daysOfStock} days of cover, ${m.effectiveLeadTimeDays}-day lead time`,
        href: `/products/${encodeURIComponent(m.product.sku)}`,
        tone: "red" as const,
      })),
    ...ws.suppliers
      .filter((s) => s.delayedPos > 0)
      .slice(0, 3)
      .map((s) => ({
        id: `n-po-${s.supplier.id}`,
        title: `${s.delayedPos} overdue PO${s.delayedPos > 1 ? "s" : ""} from ${s.supplier.name}`,
        body: `On-time rate ${(s.onTimeRate * 100).toFixed(0)}% over the last 12 months`,
        href: `/suppliers/${s.supplier.code.toLowerCase()}`,
        tone: "amber" as const,
      })),
    ...ws.metrics
      .filter((m) => m.hasSpike)
      .slice(0, 2)
      .map((m) => ({ id: `n-spike-${m.product.id}`, title: `Demand spike: ${m.product.sku}`, body: `${m.product.name} sold well above its 12-week average last week`, href: `/products/${encodeURIComponent(m.product.sku)}`, tone: "blue" as const })),
  ];

  return (
    <AppShell
      companyName={session.company.name}
      userName={session.user.fullName}
      userEmail={session.user.email}
      role={session.role}
      searchIndex={searchIndex}
      notifications={notifications}
      badges={badges}
      trialDaysRemaining={session.company.trialDaysRemaining}
      isSample={ws.isSample}
    >
      {children}
    </AppShell>
  );
}
