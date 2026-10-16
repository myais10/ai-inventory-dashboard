import type { Metadata } from "next";
import Link from "next/link";
import { isManager, requireSession } from "@/lib/auth/session";
import { ctxOf, listMembers } from "@/lib/services/context";
import { listTasks, taskCounts, type TaskBucket } from "@/lib/services/tasks";
import { NewTaskButton, TaskItem } from "@/components/app/task-list";
import { cn } from "@/lib/utils";
import { AssigneeFilter } from "./assignee-filter";

export const metadata: Metadata = { title: "Tasks" };

const BUCKETS: { key: TaskBucket; label: string; empty: string }[] = [
  { key: "overdue", label: "Overdue", empty: "Nothing overdue. Promises kept." },
  { key: "today", label: "Due today", empty: "Nothing else due today." },
  { key: "upcoming", label: "Upcoming", empty: "Nothing scheduled yet." },
  { key: "done", label: "Done", empty: "No completed tasks yet." },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ bucket?: string; assignee?: string }> }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const sp = await searchParams;
  const manager = isManager(session);
  const assignee = manager ? (sp.assignee ?? "me") : "me";
  const tz = session.org.timezone;
  const counts = await taskCounts(ctx, assignee, tz);
  const bucket = (BUCKETS.some((b) => b.key === sp.bucket) ? sp.bucket : counts.overdue ? "overdue" : "today") as TaskBucket;
  const [rows, members] = await Promise.all([listTasks(ctx, { bucket, assignee, tz }), manager ? listMembers(ctx) : Promise.resolve([])]);
  const meta = BUCKETS.find((b) => b.key === bucket)!;
  const href = (b: TaskBucket) => `/tasks?bucket=${b}${assignee !== "me" ? `&assignee=${assignee}` : ""}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted">Callbacks and follow-ups are created automatically from call outcomes. Calling a lead closes its open follow-ups.</p>
        </div>
        <div className="flex items-center gap-2">
          {manager && <AssigneeFilter value={assignee} members={members.map((m) => ({ id: m.id, name: m.name }))} />}
          <NewTaskButton tz={tz} size="md" members={manager ? members.map((m) => ({ id: m.id, name: m.name })) : undefined} />
        </div>
      </div>
      <nav aria-label="Task buckets" className="mb-3 flex gap-1 border-b border-line">
        {BUCKETS.map((b) => {
          const n = b.key === "done" ? null : counts[b.key];
          return (
            <Link
              key={b.key}
              href={href(b.key)}
              aria-current={b.key === bucket ? "page" : undefined}
              className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium", b.key === bucket ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink")}
            >
              {b.label}
              {n !== null && n > 0 && <span className={cn("tabular rounded-full px-1.5 text-[11px]", b.key === "overdue" ? "bg-red-50 text-red-700" : "bg-slate-100 text-muted")}>{n}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted">{meta.empty}</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {rows.map((r) => (
              <TaskItem
                key={r.task.id}
                tz={tz}
                showLead
                showAssignee={assignee !== "me"}
                t={{ ...r.task, leadName: r.leadFirst ? `${r.leadFirst} ${r.leadLast}` : null, companyName: r.companyName, dealName: r.dealName, assignee: r.assignee }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
