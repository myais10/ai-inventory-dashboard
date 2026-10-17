import type { Metadata } from "next";
import { isManager, requireSession } from "@/lib/auth/session";
import { ctxOf, listMembers } from "@/lib/services/context";
import { listTasks, taskCounts, type TaskBucket } from "@/lib/services/tasks";
import { NewTaskButton, TaskItem } from "@/components/app/task-list";
import { CheckCheck } from "lucide-react";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
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
    <div className="max-w-5xl px-4 py-5 sm:px-6">
      <PageHeader
        title="Tasks"
        description="Callbacks and follow-ups are created automatically from call outcomes. Calling a lead closes its open follow-ups."
        className="mb-3"
        actions={
          <>
            {manager && <AssigneeFilter value={assignee} members={members.map((m) => ({ id: m.id, name: m.name }))} />}
            <NewTaskButton tz={tz} size="md" members={manager ? members.map((m) => ({ id: m.id, name: m.name })) : undefined} />
          </>
        }
      />
      <div className="mb-3">
        <Tabs
          label="Task buckets"
          tabs={BUCKETS.map((b) => ({ href: href(b.key), label: b.label, active: b.key === bucket, count: b.key === "done" ? undefined : counts[b.key], tone: b.key === "overdue" ? ("red" as const) : undefined }))}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        {rows.length === 0 ? (
          <EmptyState icon={CheckCheck} title={meta.empty} />
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
