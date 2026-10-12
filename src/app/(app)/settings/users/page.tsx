import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_META, can } from "@/lib/auth/permissions";
import type { Role } from "@/lib/types";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/app/settings-tabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TeamManager } from "../forms";

export const metadata: Metadata = { title: "Users & Permissions" };

export default async function UsersPage() {
  const session = await requireSession();
  let members: { name: string; email: string; role: string; status: string; lastActive: string }[] = [
    { name: session.user.fullName, email: session.user.email, role: session.role, status: "Active", lastActive: "Now" },
  ];

  if (session.mode === "supabase") {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.from("memberships").select("role, status, invited_email, user_id, profiles:user_id(full_name)").eq("company_id", session.company.id);
    if (data?.length) {
      members = data.map((m) => {
        const profile = m.profiles as unknown as { full_name?: string } | null;
        return {
          name: profile?.full_name ?? m.invited_email ?? "Member",
          email: m.user_id === session.user.id ? session.user.email : (m.invited_email ?? "—"),
          role: m.role as string,
          status: m.status === "active" ? "Active" : m.status === "invited" ? "Invited" : "Disabled",
          lastActive: m.user_id === session.user.id ? "Now" : "—",
        };
      });
    }
  } else if (session.company.id === "cmp-northstar") {
    members = [
      ...members,
      { name: "Maria Gonzalez", email: "maria@northstarsupply.com", role: "admin", status: "Active", lastActive: "2 hours ago" },
      { name: "Dave Thompson", email: "dave@northstarsupply.com", role: "manager", status: "Active", lastActive: "Yesterday" },
      { name: "Priya Shah", email: "priya@northstarsupply.com", role: "manager", status: "Active", lastActive: "3 days ago" },
      { name: "Tom Becker", email: "tom@northstarsupply.com", role: "viewer", status: "Invited", lastActive: "—" },
    ];
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your workspace, team and data." />
      <SettingsTabs active="/settings/users" />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Team members" description={`${members.length} members · data is only visible to members of ${session.company.name}`} />
          <TeamManager members={members} canManage={can(session.role, "users:manage")} />
        </Card>
        <Card>
          <CardHeader title="Roles & permissions" />
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr>
                  <th className="bg-subtle px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-muted">Permission</th>
                  {(Object.keys(ROLE_META) as Role[]).map((r) => (
                    <th key={r} className="bg-subtle px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
                      {ROLE_META[r].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line/70">
                  <td className="px-5 py-2.5 text-ink-2">View dashboards, recommendations & reports</td>
                  {(Object.keys(ROLE_META) as Role[]).map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      <Check className="mx-auto h-4 w-4 text-emerald-600" />
                    </td>
                  ))}
                </tr>
                {ALL_PERMISSIONS.map((p) => (
                  <tr key={p} className="border-t border-line/70">
                    <td className="px-5 py-2.5 text-ink-2">{PERMISSION_LABELS[p]}</td>
                    {(Object.keys(ROLE_META) as Role[]).map((r) => (
                      <td key={r} className="px-3 py-2.5 text-center">
                        {can(r, p) ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <Minus className="mx-auto h-4 w-4 text-faint" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(ROLE_META) as Role[]).map((r) => (
              <div key={r} className="text-[12.5px]">
                <div className="font-semibold text-ink">{ROLE_META[r].label}</div>
                <div className="text-muted">{ROLE_META[r].description}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
