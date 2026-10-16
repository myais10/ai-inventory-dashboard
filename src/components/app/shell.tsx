"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Keyboard, LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { logoutAction } from "@/app/(auth)/actions";
import { searchAction } from "@/app/(app)/actions";
import { LogoMark } from "./logo";
import { NAV } from "./nav";
import { Kbd, ShortcutsProvider, useShortcutHelp, useShortcuts } from "./shortcuts";
import { ToastProvider } from "@/components/ui/toast";

export interface ShellProps {
  children: ReactNode;
  orgName: string;
  user: { name: string; email: string; role: string; title: string | null };
  isManager: boolean;
  badges: { queue: number; tasks: number; unassigned: number };
}

type SearchResult = Awaited<ReturnType<typeof searchAction>>[number];

function CommandPalette({ open, onClose, isManager }: { open: boolean; onClose: () => void; isManager: boolean }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const pages = useMemo(
    () => NAV.filter((n) => isManager || !n.managerOnly).map((n) => ({ type: "Page" as const, label: n.label, sub: undefined as string | undefined, href: n.href })),
    [isManager],
  );

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => start(async () => setResults(await searchAction(q))), 140);
    return () => clearTimeout(t);
  }, [q]);

  const items = q.trim().length < 2 ? pages : [...results, ...pages.filter((p) => p.label.toLowerCase().includes(q.trim().toLowerCase()))];
  if (!open) return null;
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-night/40 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-white shadow-2xl animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            role="combobox"
            aria-label="Search leads, companies and pages"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[idx] ? `palette-${idx}` : undefined}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(items.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && items[idx]) go(items[idx].href);
            }}
            placeholder="Search leads, companies, phone numbers…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {pending && <span className="text-[11px] text-faint">Searching…</span>}
          <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">ESC</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && !pending && <li className="px-3 py-8 text-center text-sm text-muted">No matches for “{q}”</li>}
          {items.map((r, i) => (
            <li
              key={`${r.type}-${r.href}`}
              id={`palette-${i}`}
              role="option"
              aria-selected={i === idx}
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(r.href)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2", i === idx && "bg-slate-100")}
            >
              <span className="w-16 shrink-0 text-[10.5px] font-medium uppercase tracking-wide text-faint">{r.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{r.label}</span>
                {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Sidebar({ isManager, badges, onNavigate }: { isManager: boolean; badges: ShellProps["badges"]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
      {NAV.filter((n) => isManager || !n.managerOnly).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badge = item.badgeKey ? badges[item.badgeKey] : 0;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
              active ? "bg-night-3 text-white" : "text-white/65 hover:bg-night-2 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand-300" : "text-white/50 group-hover:text-white/80")} aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {badge > 0 && (
              <span className={cn("tabular rounded px-1.5 text-[11px] font-semibold", item.badgeKey === "tasks" ? "bg-amber-400/15 text-amber-300" : "bg-brand-500/15 text-brand-300")}>
                {badge}
                <span className="sr-only"> {item.badgeKey === "queue" ? "leads due" : item.badgeKey === "tasks" ? "tasks due" : "unassigned leads"}</span>
              </span>
            )}
            <Kbd keys={item.keys} className="hidden text-white/30 group-hover:inline xl:inline" />
          </Link>
        );
      })}
    </nav>
  );
}

function ShellInner({ children, orgName, user, isManager, badges }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const openHelp = useShortcutHelp();
  useEffect(() => setMobileOpen(false), [pathname]);

  useShortcuts(
    [
      { keys: "mod+k", label: "Search everything", group: "General", run: () => setPaletteOpen(true), allowInInput: true },
      { keys: "/", label: "Search everything", group: "General", run: () => setPaletteOpen(true) },
    ],
    [],
  );

  const userBlock = (
    <div className="border-t border-night-3 p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-night" aria-hidden>
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{user.name}</div>
          <div className="truncate text-[11px] text-white/50">{user.title ?? user.role}</div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="rounded p-1.5 text-white/50 hover:bg-night-2 hover:text-white" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <div className="flex h-14 items-center gap-2.5 px-4">
      <LogoMark className="h-6 w-6" />
      <div className="min-w-0 leading-tight">
        <div className="text-[13px] font-semibold text-white">Phoonica</div>
        <div className="truncate text-[11px] text-white/50">{orgName}</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-night lg:flex">
        {brand}
        <div className="px-2.5">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 w-full items-center gap-2 rounded-md border border-night-3 bg-night-2 px-2.5 text-left text-[12.5px] text-white/50 hover:text-white/80"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="flex-1">Search</span>
            <Kbd keys="mod+k" className="text-white/40" />
          </button>
        </div>
        <Sidebar isManager={isManager} badges={badges} />
        <button type="button" onClick={openHelp} className="mx-2.5 mb-2 flex h-8 items-center gap-2 rounded-md px-2.5 text-[12.5px] text-white/50 hover:bg-night-2 hover:text-white">
          <Keyboard className="h-3.5 w-3.5" aria-hidden /> Shortcuts <Kbd keys="?" className="ml-auto" />
        </button>
        {userBlock}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-night/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-night animate-fade-in">
            <div className="flex items-center justify-between pr-2">
              {brand}
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded p-1.5 text-white/60 hover:text-white" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Sidebar isManager={isManager} badges={badges} onNavigate={() => setMobileOpen(false)} />
            {userBlock}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-white px-4 lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-slate-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <LogoMark className="h-6 w-6" />
          <span className="flex-1 truncate text-sm font-semibold">Phoonica</span>
          <button type="button" onClick={() => setPaletteOpen(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-slate-100" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
        </header>
        <main id="main" className="w-full min-w-0 flex-1">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} isManager={isManager} />
    </div>
  );
}

export function AppShell(props: ShellProps) {
  const nav = NAV.filter((n) => props.isManager || !n.managerOnly).map((n) => ({ keys: n.keys, label: n.label, href: n.href }));
  return (
    <ToastProvider>
      <ShortcutsProvider nav={nav}>
        <ShellInner {...props} />
      </ShortcutsProvider>
    </ToastProvider>
  );
}
