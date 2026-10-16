import { requireSession, isManager } from "@/lib/auth/session";
import { AppShell } from "@/components/app/shell";
import { getBadges } from "@/lib/services/badges";
import { ctxOf } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const badges = await getBadges(ctxOf(session), session.org.timezone);
  return (
    <AppShell
      orgName={session.org.name}
      user={{ name: session.user.name, email: session.user.email, role: session.role, title: session.title }}
      isManager={isManager(session)}
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
