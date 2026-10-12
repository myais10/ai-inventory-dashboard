import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/app/settings-tabs";
import { ProfileForm } from "../forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireSession();
  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your workspace, team and data." />
      <SettingsTabs active="/settings/profile" />
      <Card className="max-w-xl">
        <CardHeader title="Your profile" description={`Role: ${session.role}`} />
        <div className="p-5">
          <ProfileForm fullName={session.user.fullName} email={session.user.email} />
        </div>
      </Card>
    </div>
  );
}
