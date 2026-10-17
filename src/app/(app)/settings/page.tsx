import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { providerStatus } from "@/lib/providers";
import { ctxOf, isManagerRole, listMembers } from "@/lib/services/context";
import { workspaceCounts } from "@/lib/services/settings";
import { Badge } from "@/components/ui";
import { DataPanel, MembersPanel, ProfileForm, WorkspaceForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-16 rounded-lg border border-line bg-surface shadow-card">
      <header className="border-b border-line px-5 py-2.5">
        <h2 id={`${id}-h`} className="text-sm font-semibold text-ink">
          {title}
        </h2>
        <p className="text-xs text-muted">{description}</p>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const [members, counts] = await Promise.all([listMembers(ctx), workspaceCounts(ctx)]);
  const owner = session.role === "owner";
  const manager = isManagerRole(session.role);
  const providers = providerStatus();

  return (
    <div className="max-w-3xl space-y-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Settings</h1>
        <nav aria-label="Settings sections" className="mt-3 flex flex-wrap gap-1.5 text-[13px]">
          {[
            ["workspace", "Workspace & ICP"],
            ["team", "Team"],
            ["integrations", "Integrations"],
            ["data", "Data"],
            ["profile", "Your profile"],
          ].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="rounded-md border border-line bg-surface px-2.5 py-1 font-medium text-ink-2 hover:border-line-strong hover:text-ink">
              {l}
            </a>
          ))}
        </nav>
      </div>

      <Section id="workspace" title="Workspace & ideal customer profile" description="The ICP drives lead scoring, and scoring drives the Next Best Lead queue.">
        <WorkspaceForm
          canEdit={manager}
          initial={{ name: session.org.name, timezone: session.org.timezone, icpIndustries: session.org.icpIndustries.join(", "), icpMinEmployees: session.org.icpMinEmployees, icpMaxEmployees: session.org.icpMaxEmployees }}
        />
      </Section>

      <Section id="team" title="Team" description="Owners manage members. Managers see the Team dashboard and can assign leads; reps work their own queue.">
        <MembersPanel members={members} canEdit={owner} selfId={session.user.id} />
      </Section>

      <Section id="integrations" title="Integrations" description="Phoonica talks to outside services through provider interfaces. Demo providers keep every workflow usable until real credentials are connected.">
        <ul className="divide-y divide-line/70">
          {providers.map(({ kind, info }) => (
            <li key={kind} className="flex items-start justify-between gap-4 py-3">
              <div>
                <div className="text-[13px] font-medium text-ink">
                  {kind} <span className="font-normal text-muted">· {info.name}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{info.description}</p>
              </div>
              <Badge tone={info.live ? "green" : "amber"} dot>
                {info.live ? "Connected" : "Demo"}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          To connect a real service, implement its interface in <code className="rounded bg-subtle px-1">src/lib/providers</code>, register it, and set e.g. <code className="rounded bg-subtle px-1">PHONE_PROVIDER=twilio</code> plus its credentials in the server environment.
        </p>
      </Section>

      <Section id="data" title="Data" description={`${counts.leads.toLocaleString()} leads and ${counts.calls.toLocaleString()} logged calls in this workspace.`}>
        <DataPanel canEdit={owner} />
      </Section>

      <Section id="profile" title="Your profile" description={session.user.email}>
        <ProfileForm name={session.user.name} />
      </Section>
    </div>
  );
}
