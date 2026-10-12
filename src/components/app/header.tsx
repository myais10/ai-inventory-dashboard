"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bell, Building2, ChevronDown, LogOut, Search, Settings, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import { AssistantPanel } from "./assistant-panel";

export interface SearchItem {
  type: "Product" | "Recommendation" | "Supplier" | "Page";
  label: string;
  sub?: string;
  href: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  href: string;
  tone: "red" | "amber" | "blue";
}

export interface HeaderProps {
  companyName: string;
  userName: string;
  userEmail: string;
  role: string;
  searchIndex: SearchItem[];
  notifications: NotificationItem[];
  mobileMenuButton?: ReactNode;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

function SearchPalette({ items, open, onClose }: { items: SearchItem[]; open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items.filter((i) => i.type === "Page").slice(0, 8);
    const terms = term.split(/\s+/);
    return items.filter((i) => terms.every((t) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(t))).slice(0, 12);
  }, [q, items]);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/30 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-white shadow-2xl animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(results.length - 1, i + 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(0, i - 1));
              if (e.key === "Enter" && results[idx]) go(results[idx].href);
            }}
            placeholder="Search products, SKUs, suppliers, recommendations…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted">No results for “{q}”</div>}
          {results.map((r, i) => (
            <button
              type="button"
              key={`${r.type}-${r.href}-${i}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(r.href)}
              className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", i === idx && "bg-slate-100")}
            >
              <span className="w-[92px] shrink-0 text-[11px] font-medium uppercase tracking-wide text-faint">{r.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{r.label}</span>
                {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Header({ companyName, userName, userEmail, role, searchIndex, notifications, mobileMenuButton }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(userRef, () => setUserOpen(false));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const unread = notifications.filter((n) => !readIds.includes(n.id)).length;
  const initials = userName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 print:hidden flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      {mobileMenuButton}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
        <div className="hidden h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-ink-2 sm:flex">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <span className="truncate text-sm font-semibold text-ink">{companyName}</span>
      </div>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="ml-auto hidden h-8 w-full max-w-[340px] items-center gap-2 sm:flex rounded-lg border border-line bg-subtle px-3 text-left text-[13px] text-faint transition-colors hover:border-line-strong md:ml-6"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">Search SKUs, products, suppliers…</span>
        <kbd className="hidden rounded border border-line bg-white px-1.5 text-[10px] text-muted sm:inline">⌘K</kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1 md:ml-auto">
        <button type="button" onClick={() => setSearchOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-slate-100 sm:hidden" aria-label="Search">
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-slate-100 sm:flex"
        >
          <Sparkles className="h-4 w-4 text-brand-600" />
          Ask
        </button>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{unread}</span>}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-10 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="text-sm font-semibold">Notifications</span>
                <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => setReadIds(notifications.map((n) => n.id))}>
                  Mark all read
                </button>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      setReadIds((r) => [...r, n.id]);
                      setNotifOpen(false);
                    }}
                    className={cn("flex gap-3 border-b border-line/70 px-4 py-3 hover:bg-subtle", readIds.includes(n.id) && "opacity-60")}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.tone === "red" ? "bg-red-500" : n.tone === "amber" ? "bg-amber-500" : "bg-sky-500")} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{n.title}</span>
                      <span className="block text-xs text-muted">{n.body}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button type="button" onClick={() => setUserOpen((o) => !o)} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 hover:bg-slate-100">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{initials}</span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted sm:block" />
          </button>
          {userOpen && (
            <div className="absolute right-0 top-10 w-60 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl animate-fade-in">
              <div className="border-b border-line px-3.5 py-2.5">
                <div className="truncate text-sm font-medium text-ink">{userName}</div>
                <div className="truncate text-xs text-muted">{userEmail}</div>
                <div className="mt-1 text-[11px] font-medium capitalize text-brand-700">{role}</div>
              </div>
              <Link href="/settings/profile" onClick={() => setUserOpen(false)} className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-subtle">
                <User className="h-3.5 w-3.5" /> Your profile
              </Link>
              <Link href="/settings/company" onClick={() => setUserOpen(false)} className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-subtle">
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
              <form action={logoutAction} className="border-t border-line">
                <button type="submit" className="flex w-full items-center gap-2 px-3.5 py-2 text-[13px] text-ink-2 hover:bg-subtle">
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <SearchPalette items={searchIndex} open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </header>
  );
}
