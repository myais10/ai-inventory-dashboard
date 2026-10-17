import { requireSession, isManager } from "@/lib/auth/session";
import { AppShell } from "@/components/app/shell";
import { getBadges } from "@/lib/services/badges";
import { ctxOf, listMyWorkspaces } from "@/lib/services/context";
import { getNotices } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const [badges, notices, workspaces] = await Promise.all([getBadges(ctx, session.org.timezone), getNotices(ctx, session.org.timezone), listMyWorkspaces(session.user.id)]);
  return (
    <AppShell
      org={{ id: session.org.id, name: session.org.name }}
      workspaces={workspaces}
      user={{ name: session.user.name, email: session.user.email, role: session.role, title: session.title }}
      isManager={isManager(session)}
      badges={badges}
      notices={notices}
    >
      {children}
    </AppShell>
  );
}
