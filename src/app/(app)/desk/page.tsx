import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { zonedDate } from "@/lib/domain/time";
import { providers } from "@/lib/providers";
import { activeCall, todayStats } from "@/lib/services/calls";
import { connectByLocalHour } from "@/lib/services/analytics";
import { ctxOf, listCampaigns } from "@/lib/services/context";
import { getQueue } from "@/lib/services/desk";
import { getLead } from "@/lib/services/leads";
import { Desk } from "./desk";

export const metadata: Metadata = { title: "Calling Desk" };

function startOfToday(tz: string) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()).split("-").map(Number);
  return zonedDate(y, m, d, 0, 0, tz);
}

export default async function DeskPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireSession();
  const ctx = ctxOf(session);
  const sp = await searchParams;
  const uuidRe = /^[0-9a-f-]{36}$/;
  const skip = (sp.skip ?? "").split(",").filter((x) => uuidRe.test(x));
  const campaignId = sp.campaign && uuidRe.test(sp.campaign) ? sp.campaign : undefined;
  const tz = session.org.timezone;

  const [queue, stats, campaigns, hours] = await Promise.all([
    getQueue(ctx, { campaignId, skip }),
    todayStats(ctx, startOfToday(tz)),
    listCampaigns(ctx),
    // Team-wide connect rate by the contact's local hour over 30 days → "best time to call".
    connectByLocalHour(ctx, new Date(Date.now() - 30 * 86_400_000), new Date()),
  ]);
  const solid = hours.filter((h) => h.dials >= 20);
  const best = solid.reduce<(typeof hours)[number] | null>((a, h) => (!a || h.connects / h.dials > a.connects / a.dials ? h : a), null);
  const requested = sp.lead && uuidRe.test(sp.lead) ? sp.lead : null;
  const currentId = requested ?? (queue.due.find((r) => r.callableNow) ?? queue.due[0])?.lead.id ?? null;
  const lead = currentId ? await getLead(ctx, currentId) : null;
  const [call, prep] = lead
    ? await Promise.all([
        activeCall(ctx, lead.lead.id),
        providers.ai().callPrep({
          sellerName: session.org.name.split(" ")[0],
          repName: session.user.firstName,
          contactName: `${lead.contact.firstName} ${lead.contact.lastName}`,
          title: lead.contact.title,
          companyName: lead.company?.name ?? null,
          industry: lead.company?.industry ?? null,
          employeeCount: lead.company?.employeeCount ?? null,
          city: lead.company?.city ?? null,
          lastNotes: lead.timeline.filter((t) => t.a.body && (t.a.type === "call" || t.a.type === "note")).map((t) => t.a.body!),
          lastDisposition: lead.lead.lastDisposition,
          attemptCount: lead.lead.attemptCount,
          source: lead.lead.source,
        }),
      ])
    : [null, null];
  const phone = providers.phone();
  const ai = providers.ai();

  return (
    <Desk
      key={lead?.lead.id ?? "empty"}
      tz={tz}
      queue={queue.due.slice(0, 40).map((r) => ({
        id: r.lead.id,
        name: `${r.lead.firstName} ${r.lead.lastName}`,
        company: r.lead.companyName,
        reason: r.reasons[0] ?? "",
        callableNow: r.callableNow,
        callback: r.lead.nextActionType === "callback",
        score: r.lead.score,
      }))}
      queueTotal={queue.due.length}
      callbacks={queue.callbacks}
      callableNow={queue.callableNow}
      skipped={skip}
      upcoming={queue.upcoming.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, company: l.companyName, at: l.nextActionAt!.toISOString(), callback: l.nextActionType === "callback" }))}
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
      campaignId={campaignId ?? ""}
      stats={stats}
      bestWindow={best ? { hour: best.hour, rate: best.connects / best.dials, avg: solid.reduce((a, h) => a + h.connects, 0) / Math.max(1, solid.reduce((a, h) => a + h.dials, 0)) } : null}
      rank={lead ? queue.due.findIndex((r) => r.lead.id === lead.lead.id) + 1 : 0}
      provider={{ name: phone.name, live: phone.live, description: phone.description }}
      aiLabel={ai.live ? ai.name : `${ai.name} (demo)`}
      lead={
        lead
          ? {
              id: lead.lead.id,
              status: lead.lead.status,
              score: lead.lead.score,
              scoreFactors: lead.lead.scoreFactors,
              attemptCount: lead.lead.attemptCount,
              connectCount: lead.lead.connectCount,
              nextActionReason: lead.lead.nextActionReason,
              nextActionType: lead.lead.nextActionType,
              nextActionAt: lead.lead.nextActionAt?.toISOString() ?? null,
              lastContactedAt: lead.lead.lastContactedAt?.toISOString() ?? null,
              source: lead.lead.source,
              ownerName: lead.owner?.name ?? null,
              campaign: lead.campaign?.name ?? null,
              canWork: lead.canWork,
              reasons: lead.ranked.reasons,
              callableNow: lead.ranked.callableNow,
              contact: {
                firstName: lead.contact.firstName,
                lastName: lead.contact.lastName,
                title: lead.contact.title,
                phone: lead.contact.phone,
                mobile: lead.contact.mobile,
                email: lead.contact.email,
                timezone: lead.contact.timezone,
                doNotCall: lead.contact.doNotCall,
                phoneInvalid: lead.contact.phoneInvalid,
              },
              company: lead.company ? { id: lead.company.id, name: lead.company.name, industry: lead.company.industry, employeeCount: lead.company.employeeCount, city: lead.company.city, state: lead.company.state } : null,
              timeline: lead.timeline.slice(0, 8).map((t) => ({
                id: t.a.id,
                type: t.a.type,
                title: t.a.title,
                disposition: t.a.disposition,
                body: t.a.body,
                at: t.a.occurredAt.toISOString(),
                user: t.userName,
                durationSec: (t.a.meta as { durationSec?: number }).durationSec ?? null,
              })),
              openTasks: lead.openTasks.map(({ task }) => ({ id: task.id, title: task.title, dueAt: task.dueAt.toISOString() })),
              colleagues: lead.colleagues,
              openDeal: lead.deals.find((d) => d.stage.kind === "open") ? { id: lead.deals.find((d) => d.stage.kind === "open")!.deal.id, stage: lead.deals.find((d) => d.stage.kind === "open")!.stage.name } : null,
            }
          : null
      }
      activeCall={call ? { callId: call.id, startedAt: call.startedAt.toISOString(), ended: !!call.endedAt, durationSec: call.durationSec } : null}
      prep={prep}
    />
  );
}
