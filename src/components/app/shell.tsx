"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { Bell, Check, ChevronsUpDown, Keyboard, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { logoutAction } from "@/app/(auth)/actions";
import { searchAction, switchWorkspaceAction } from "@/app/(app)/actions";
import { ToastProvider } from "@/components/ui/toast";
import type { Notice } from "@/lib/services/notifications";
import { Logo } from "./logo";
import { NAV } from "./nav";
import { Kbd, ShortcutsProvider, useShortcutHelp, useShortcuts } from "./shortcuts";

export interface ShellProps {
  children: ReactNode;
  org: { id: string; name: string };
  workspaces: { id: string; name: string; role: string }[];
  user: { name: string; email: string; role: string; title: string | null };
  isManager: boolean;
  badges: { queue: number; tasks: number; unassigned: number };
  notices: Notice[];
}

type SearchResult = Awaited<ReturnType<typeof searchAction>>[number];

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const menuClass = "absolute z-50 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface shadow-elevated animate-fade-in";

// ---------- Command palette ----------

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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-elevated animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" strokeWidth={1.75} aria-hidden />
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
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
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
              className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2", i === idx && "bg-brand-100")}
            >
              <span className="w-16 shrink-0 text-[10.5px] font-medium uppercase tracking-wider text-faint">{r.type}</span>
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

// ---------- Sidebar ----------

function WorkspaceSwitcher({ org, workspaces }: { org: ShellProps["org"]; workspaces: ShellProps["workspaces"] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useDismiss(open, () => setOpen(false));
  const multi = workspaces.length > 1;
  return (
    <div ref={ref} className="relative px-2.5">
      <button
        type="button"
        onClick={() => multi && setOpen((o) => !o)}
        aria-haspopup={multi ? "menu" : undefined}
        aria-expanded={multi ? open : undefined}
        className={cn("flex h-9 w-full items-center gap-2 rounded-md border border-line bg-subtle px-2.5 text-left", multi ? "hover:border-line-strong" : "cursor-default")}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-100 text-[10px] font-bold text-brand-200" aria-hidden>
          {initials(org.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{org.name}</span>
        {multi && <ChevronsUpDown className="h-3.5 w-3.5 text-faint" aria-hidden />}
      </button>
      {open && (
        <div role="menu" className={cn(menuClass, "left-2.5 right-2.5")}>
          <div className="px-3 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-wider text-faint">Workspaces</div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              role="menuitem"
              type="button"
              disabled={pending}
              onClick={() => w.id !== org.id && start(() => void switchWorkspaceAction(w.id))}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-2 hover:bg-subtle"
            >
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              <span className="text-[11px] capitalize text-faint">{w.role}</span>
              {w.id === org.id && <Check className="h-3.5 w-3.5 text-brand-300" aria-label="Current" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarNav({ isManager, badges, onNavigate }: { isManager: boolean; badges: ShellProps["badges"]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => isManager || !n.managerOnly);
  const groups = ["Sell", "Manage", "Workspace"] as const;
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2.5 py-3">
      {groups.map((g) => {
        const gi = items.filter((n) => n.group === g);
        if (!gi.length) return null;
        return (
          <div key={g} className="mb-3">
            {g !== "Sell" && <div className="mb-1 px-2.5 text-[10.5px] font-medium uppercase tracking-wider text-faint">{g}</div>}
            <ul className="space-y-px">
              {gi.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                        active ? "bg-brand-100 text-ink" : "text-muted hover:bg-subtle hover:text-ink",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand-300" : "text-faint group-hover:text-muted")} strokeWidth={1.75} aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span className={cn("tabular min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold", item.badgeKey === "tasks" ? "bg-amber-500/15 text-amber-300" : "bg-brand-500/20 text-brand-200")}>
                          {badge}
                          <span className="sr-only"> {item.badgeKey === "queue" ? "leads due" : item.badgeKey === "tasks" ? "tasks due" : "unassigned leads"}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// ---------- Topbar ----------

function Notifications({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const dot = { red: "bg-red-400", amber: "bg-amber-400", brand: "bg-brand-300", blue: "bg-sky-400" };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${notices.length ? ` (${notices.length})` : ""}`}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-ink"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {notices.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-400 ring-2 ring-canvas" aria-hidden />}
      </button>
      {open && (
        <div className={cn(menuClass, "right-0 w-[340px] max-w-[calc(100vw-2rem)]")}>
          <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Needs your attention</div>
          {notices.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {notices.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex gap-3 border-b border-line/70 px-4 py-2.5 last:border-0 hover:bg-subtle">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[n.tone])} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{n.title}</span>
                      <span className="block truncate text-xs text-muted">{n.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu({ user }: { user: ShellProps["user"] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const openHelp = useShortcutHelp();
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open} className="flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-line-strong">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white" aria-hidden>
          {initials(user.name)}
        </span>
      </button>
      {open && (
        <div className={cn(menuClass, "right-0 w-60")} role="menu">
          <div className="border-b border-line px-3.5 py-2.5">
            <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
            <div className="mt-0.5 text-[11px] capitalize text-brand-300">{user.title ?? user.role}</div>
          </div>
          <Link href="/settings#profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-subtle">
            <Settings className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Profile & settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openHelp();
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-ink-2 hover:bg-subtle"
          >
            <Keyboard className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Keyboard shortcuts <Kbd keys="?" className="ml-auto text-faint" />
          </button>
          <form action={logoutAction} className="border-t border-line">
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-subtle">
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------- Shell ----------

function ShellInner({ children, org, workspaces, user, isManager, badges, notices }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);

  useShortcuts(
    [
      { keys: "mod+k", label: "Search everything", group: "General", run: () => setPaletteOpen(true), allowInInput: true },
      { keys: "/", label: "Search everything", group: "General", run: () => setPaletteOpen(true) },
    ],
    [],
  );

  const sidebar = (onNavigate?: () => void) => (
    <>
      <div className="flex h-12 items-center px-4">
        <Link href="/" aria-label="Phoonica home">
          <Logo />
        </Link>
      </div>
      <WorkspaceSwitcher org={org} workspaces={workspaces} />
      <SidebarNav isManager={isManager} badges={badges} onNavigate={onNavigate} />
    </>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line bg-surface lg:flex">{sidebar()}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-line bg-surface animate-fade-in">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-2 top-2.5 rounded-md p-1.5 text-muted hover:text-ink" aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            {sidebar(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-canvas/90 px-3 backdrop-blur sm:px-5">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-ink-2 hover:bg-subtle lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-left text-[13px] text-faint transition-colors hover:border-line-strong sm:max-w-[360px]"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            <span className="flex-1 truncate">Search leads, companies, numbers…</span>
            <Kbd keys="mod+k" className="hidden text-faint sm:inline" />
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Notifications notices={notices} />
            <UserMenu user={user} />
          </div>
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
