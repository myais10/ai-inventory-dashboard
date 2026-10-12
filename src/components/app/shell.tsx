"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { Logo, LogoMark } from "./logo";
import { Header, type HeaderProps } from "./header";

export interface ShellProps extends HeaderProps {
  children: ReactNode;
  badges: Record<string, number>;
  trialDaysRemaining: number;
  isSample: boolean;
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function SidebarNav({ collapsed, badges, onNavigate }: { collapsed: boolean; badges: Record<string, number>; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV.filter((n) => n.children).map((n) => [n.href, pathname.startsWith(n.href) || n.href === "/recommendations"])),
  );

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3 scroll-thin">
      {NAV.map((item) => {
        const Icon = item.icon!;
        const sectionActive = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/demand" && pathname.startsWith("/demand"));
        const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
        if (!item.children || collapsed) {
          const href = item.children ? item.children[0].href : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors",
                sectionActive ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-line" : "text-ink-2 hover:bg-slate-200/50",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", sectionActive ? "text-brand-600" : "text-muted group-hover:text-ink-2")} />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && badge ? <span className="tabular rounded-full bg-red-50 px-1.5 text-[11px] font-semibold text-red-700">{badge}</span> : null}
            </Link>
          );
        }
        const isOpen = open[item.href];
        return (
          <div key={item.href}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [item.href]: !o[item.href] }))}
              className={cn(
                "group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-slate-200/50",
                sectionActive ? "text-ink" : "text-ink-2",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", sectionActive ? "text-brand-600" : "text-muted group-hover:text-ink-2")} />
              <span className="flex-1 truncate text-left">{item.label}</span>
              {badge ? <span className="tabular rounded-full bg-red-50 px-1.5 text-[11px] font-semibold text-red-700">{badge}</span> : null}
              <ChevronDown className={cn("h-3.5 w-3.5 text-faint transition-transform", !isOpen && "-rotate-90")} />
            </button>
            {isOpen && (
              <div className="relative mb-1 ml-[17px] mt-0.5 space-y-0.5 border-l border-line pl-2.5">
                {item.children.map((c) => {
                  const active = pathname === c.href || (c.href !== item.href && pathname.startsWith(`${c.href}/`));
                  const cb = c.badgeKey ? badges[c.badgeKey] : undefined;
                  return (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-7 items-center justify-between rounded-md px-2 text-[12.5px] transition-colors",
                        active ? "bg-white font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-line" : "text-muted hover:bg-slate-200/50 hover:text-ink",
                      )}
                    >
                      <span className="truncate">{c.label}</span>
                      {cb ? <span className="tabular text-[11px] text-faint">{cb}</span> : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function TrialCard({ days, collapsed }: { days: number; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="m-3 rounded-lg border border-line bg-white p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink">Free trial</span>
        <span className="tabular text-muted">{days} of 7 days left</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${((7 - days) / 7) * 100}%` }} />
      </div>
      <Link href="/settings/billing" className="mt-2.5 block text-xs font-medium text-brand-600 hover:text-brand-700">
        Choose a plan →
      </Link>
    </div>
  );
}

export function AppShell({ children, badges, trialDaysRemaining, isSample, ...header }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("aii.sidebar") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("aii.sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-[#f3f4f7] transition-[width] duration-200 lg:flex",
          collapsed ? "w-[60px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-line", collapsed ? "justify-center" : "px-4")}>
          <Link href="/dashboard">{collapsed ? <LogoMark /> : <Logo />}</Link>
        </div>
        <SidebarNav collapsed={collapsed} badges={badges} />
        <TrialCard days={trialDaysRemaining} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          className="flex h-10 items-center justify-center gap-2 border-t border-line text-xs text-muted hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : (<><ChevronsLeft className="h-4 w-4" /> Collapse</>)}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[272px] flex-col bg-[#f3f4f7] shadow-xl animate-fade-in">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Logo />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded p-1 text-muted hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav collapsed={false} badges={badges} onNavigate={() => setMobileOpen(false)} />
            <TrialCard days={trialDaysRemaining} collapsed={false} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          {...header}
          mobileMenuButton={
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          }
        />
        <div className="flex items-center justify-center gap-2 border-b border-brand-100 bg-brand-50/70 px-4 py-1.5 text-center text-xs text-brand-900">
          <span className="font-medium">7-day free trial · {trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} remaining</span>
          {isSample && <span className="hidden text-brand-700/80 sm:inline">· Viewing sample data for Northstar Industrial Supply</span>}
          <Link href={isSample ? "/settings/data-sources" : "/settings/billing"} className="font-medium text-brand-700 underline-offset-2 hover:underline">
            {isSample ? "Import your data" : "Upgrade"}
          </Link>
        </div>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
