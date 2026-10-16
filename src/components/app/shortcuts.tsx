"use client";

// Global keyboard layer. Pages register shortcuts with useShortcuts(); "g x" sequences navigate;
// "?" lists everything currently active. Ignored while typing in inputs unless `allowInInput`.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";

export interface Shortcut {
  keys: string; // "j", "shift+n", "mod+k", "g d"
  label: string;
  group?: string;
  run: (e: KeyboardEvent) => void;
  allowInInput?: boolean;
}

interface Ctx {
  register: (id: string, s: Shortcut[]) => void;
  unregister: (id: string) => void;
  openHelp: () => void;
}

const ShortcutCtx = createContext<Ctx | null>(null);

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function keyName(e: KeyboardEvent) {
  const mods: string[] = [];
  if (e.metaKey || e.ctrlKey) mods.push("mod");
  if (e.altKey) mods.push("alt");
  // Punctuation such as "?" already encodes shift; letters, digits and named keys get an explicit modifier.
  if (e.shiftKey && (e.key.length > 1 || /[a-z0-9]/i.test(e.key))) mods.push("shift");
  return [...mods, e.key.toLowerCase()].join("+");
}

export function formatKeys(keys: string) {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return keys.split(" ").map((chord) =>
    chord
      .split("+")
      .map((p) => (p === "mod" ? (mac ? "⌘" : "Ctrl") : p === "shift" ? "⇧" : p === "enter" ? "↵" : p === "escape" ? "Esc" : p.length === 1 ? p.toUpperCase() : p))
      .join(mac ? "" : "+"),
  );
}

export function Kbd({ keys, className }: { keys: string; className?: string }) {
  return (
    <span className={className}>
      {formatKeys(keys).map((k, i) => (
        <kbd key={i} className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded border border-current/20 px-1 text-[10px] leading-4 opacity-80">
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutsProvider({ children, nav }: { children: ReactNode; nav: { keys: string; label: string; href: string }[] }) {
  const registry = useRef(new Map<string, Shortcut[]>());
  const [helpOpen, setHelpOpen] = useState(false);
  const [, force] = useState(0);
  const pending = useRef<{ key: string; at: number } | null>(null);
  const router = useRouter();

  const register = useCallback((id: string, s: Shortcut[]) => {
    registry.current.set(id, s);
    force((n) => n + 1);
  }, []);
  const unregister = useCallback((id: string) => {
    registry.current.delete(id);
    force((n) => n + 1);
  }, []);

  const globals = useMemo<Shortcut[]>(
    () => [
      ...nav.map((n) => ({ keys: n.keys, label: n.label, group: "Navigate", run: () => router.push(n.href) })),
      { keys: "?", label: "Show keyboard shortcuts", group: "General", run: () => setHelpOpen(true) },
    ],
    [nav, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const name = keyName(e);
      const typing = isTyping(e.target);
      // Enter/Space on a focused link or button must activate it, not a page shortcut.
      if ((name === "enter" || name === " ") && (e.target as HTMLElement | null)?.closest?.("a,button,[role=button],[role=option],summary")) return;
      const all = [...Array.from(registry.current.values()).flat(), ...globals];
      const now = Date.now();
      const seq = pending.current && now - pending.current.at < 1200 ? `${pending.current.key} ${name}` : null;
      const match = (seq && all.find((s) => s.keys === seq)) || all.find((s) => s.keys === name);
      if (match && (!typing || match.allowInInput)) {
        e.preventDefault();
        pending.current = null;
        match.run(e);
        return;
      }
      if (!typing && all.some((s) => s.keys.startsWith(`${name} `))) {
        pending.current = { key: name, at: now };
      } else pending.current = null;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [globals]);

  const groups = useMemo(() => {
    const out = new Map<string, Shortcut[]>();
    for (const s of [...Array.from(registry.current.values()).flat(), ...globals]) {
      const g = s.group ?? "This page";
      out.set(g, [...(out.get(g) ?? []), s]);
    }
    return Array.from(out.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globals, helpOpen]);

  return (
    <ShortcutCtx.Provider value={{ register, unregister, openHelp: () => setHelpOpen(true) }}>
      {children}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts" className="max-w-2xl">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {groups.map(([g, items]) => (
            <section key={g}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{g}</h3>
              <ul className="space-y-1">
                {items.map((s) => (
                  <li key={s.keys + s.label} className="flex items-center justify-between gap-3 text-[13px] text-ink-2">
                    <span>{s.label}</span>
                    <Kbd keys={s.keys} className="text-ink" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Dialog>
    </ShortcutCtx.Provider>
  );
}

let seq = 0;
export function useShortcuts(shortcuts: Shortcut[], deps: unknown[] = []) {
  const ctx = useContext(ShortcutCtx);
  const id = useRef(`s${++seq}`);
  useEffect(() => {
    if (!ctx) return;
    const key = id.current;
    ctx.register(key, shortcuts);
    return () => ctx.unregister(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useShortcutHelp() {
  return useContext(ShortcutCtx)?.openHelp ?? (() => {});
}
