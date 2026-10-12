import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { OnboardingFlow } from "./onboarding-flow";
import { CreateCompany } from "./create-company";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.company) return <CreateCompany />;
  return (
    <OnboardingFlow
      firstName={session.user.firstName}
      companyName={session.company.name}
      industry={session.company.industry}
      alreadyOnboarded={session.onboarded}
      trialDays={session.company.trialDaysRemaining}
    />
  );
}
