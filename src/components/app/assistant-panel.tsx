"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { askAssistantAction } from "@/app/(app)/actions";
import type { AssistantAnswer } from "@/lib/ai/assistant";

interface Message {
  role: "user" | "assistant";
  text: string;
  answer?: AssistantAnswer;
}

const SUGGESTIONS = [
  "Why are we at risk of running out of bearings?",
  "What should I reorder this week?",
  "Which suppliers are causing delays?",
  "How much cash is tied up in slow stock?",
];

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, pending]);

  if (!open) return null;

  const ask = (q: string) => {
    const question = q.trim();
    if (!question || pending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    start(async () => {
      const res = await askAssistantAction(question);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, answer: res }]);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[440px] flex-col border-l border-line bg-white shadow-2xl animate-slide-in">
        <div className="flex h-14 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <span className="text-sm font-semibold">Inventory Assistant</span>
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">Preview</span>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-slate-100" aria-label="Close assistant">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 && (
            <div>
              <p className="text-sm text-ink-2">Ask about stock, demand, suppliers or recommendations. Answers are built from your calculated inventory data — numbers are never invented.</p>
              <div className="mt-4 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button type="button" key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-line px-3 py-2 text-left text-[13px] text-ink-2 hover:border-brand-200 hover:bg-brand-50/50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-10 rounded-lg bg-slate-100 px-3 py-2 text-[13px] text-ink">
                {m.text}
              </div>
            ) : (
              <div key={i} className="text-[13px] text-ink-2">
                <p className="text-ink">{m.text}</p>
                {m.answer && m.answer.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {m.answer.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.answer?.links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={onClose} className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                    {l.label} →
                  </Link>
                ))}
              </div>
            ),
          )}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing your data…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="border-t border-line p-3"
        >
          <div className="flex items-center gap-2 rounded-lg border border-line-strong px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your inventory…"
              maxLength={300}
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
            <button type="submit" disabled={!input.trim() || pending} className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white disabled:opacity-40" aria-label="Send">
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
