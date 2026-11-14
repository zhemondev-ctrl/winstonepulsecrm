import { SystemManualCard } from "@/components/crm/SystemManualCard";
import { DailyAllocationSummary } from "@/components/crm/DailyAllocationSummary";
import { LeadPoolNotice } from "@/components/crm/hq/LeadPoolNotice";
import { AgentTargetPanel } from "@/components/crm/hq/AgentTargetPanel";
import { AgentKpiDashboard } from "@/components/crm/hq/AgentKpiDashboard";
import { AgentSalesScorecards } from "@/components/crm/hq/AgentSalesScorecards";
import { ScoreFormulaSettings } from "@/components/crm/hq/ScoreFormulaSettings";
import { DailyScoresPanel } from "@/components/crm/hq/DailyScoresPanel";
import { Button } from "@/components/ui/button";
import { AgentSelfLeadsPanel } from "@/components/crm/hq/AgentSelfLeadsPanel";
import { DistributionFailurePanel } from "@/components/crm/DistributionFailurePanel";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";

import { PAGE_SECTIONS, sectionSearch, useSection } from "@/lib/page-sections";
import { Lead360Workspace } from "@/components/crm/hq/Lead360Workspace";

import { AgentDossier } from "@/components/crm/AgentDossier";
import { HqDrillSheet, type DrillSpec } from "@/components/crm/HqDrillSheet";
import { AgentRadar } from "@/components/crm/AgentRadar";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { AskHqPanel } from "@/components/crm/AskHqPanel";
import { ExecutiveBrief } from "@/components/crm/ExecutiveBrief";
import { ShiftSummaryPanel } from "@/components/crm/ShiftSummaryPanel";
import { Leaderboard } from "@/components/crm/Leaderboard";
import { LeadDossier } from "@/components/crm/LeadDossier";
import { RoleGate } from "@/components/crm/RoleGate";
import { MaintenanceProfileNotice } from "@/components/crm/MaintenanceNotice";
import { SmartInsightStrip } from "@/components/crm/SmartInsightStrip";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { AppShell } from "@/components/crm/AppShell";
import { ExecutiveOverview } from "@/components/crm/hq/ExecutiveOverview";
import { SalesCommandCenter } from "@/components/crm/hq/SalesCommandCenter";
import { HqHeader } from "@/components/crm/hq/HqHeader";
import { HqStatTiles } from "@/components/crm/hq/HqStatTiles";
import { HqSmartSummary } from "@/components/crm/hq/HqSmartSummary";
import { HqClassificationTiles } from "@/components/crm/hq/HqClassificationTiles";
import { HqMixCards } from "@/components/crm/hq/HqMixCards";
import { SalesChartsDashboard } from "@/components/crm/SalesChartsDashboard";
import { HqTalkChart } from "@/components/crm/hq/HqTalkChart";
import { HqRecentSummaries } from "@/components/crm/hq/HqRecentSummaries";
import { FloorLockAdminPanel } from "@/components/crm/hq/FloorLockAdminPanel";

import { MarketNewsFeed } from "@/components/crm/news/MarketNewsFeed";
import { FactsBoard } from "@/components/crm/sales-intel/SalesIntelPanels";
import { AccountabilityReviewPanel } from "@/components/crm/AccountabilityReviewPanel";
import { NeglectDisputePanel } from "@/components/crm/LeadNeglectPanel";
import { SocialHqPanel } from "@/components/crm/social/SocialHqPanel";
import { ReportsBoard } from "@/components/crm/reports/ReportsBoard";
import { ConversationOutcomesPanel } from "@/components/crm/hq/ConversationOutcomesPanel";
import { WhatsappAgentSummary } from "@/components/crm/hq/WhatsappAgentSummary";

import { buildAgentStats, buildTimeline, useSnapshot } from "@/lib/crm-data";
import { useT } from "@/lib/i18n";

const HQ_TABS = PAGE_SECTIONS["/hq"];
const ClosureRecoveryQueue = lazy(() => import("@/components/crm/hq/ClosureRecoveryQueue").then(m => ({ default: m.ClosureRecoveryQueue })));
const VipRecoveryQueue = lazy(() => import("@/components/crm/hq/VipRecoveryQueue").then(m => ({ default: m.VipRecoveryQueue })));
const DailyAgentAudit = lazy(() => import("@/components/crm/hq/DailyAgentAudit").then(m => ({ default: m.DailyAgentAudit })));
const SiteVisitAlerts = lazy(() => import("@/components/crm/hq/SiteVisitAlerts").then(m => ({ default: m.SiteVisitAlerts })));

export const Route = createFileRoute("/hq")({
  validateSearch: sectionSearch,
  head: () => ({
    meta: [
      { title: "Executive HQ — Winstone Pulse" },
      {
        name: "description",
        content:
          "Executive Headquarters (HQ): central management view of live team performance, agent performance, leaderboards and call/report metrics.",
      },
      { property: "og:title", content: "Executive HQ — Winstone Pulse" },
      {
        property: "og:description",
        content:
          "Audit submitted reports, call attempts and completed assigned work, with optional recording and sync diagnostics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: () => (
    <AppShell>
      <SnapshotSkeleton />
    </AppShell>
  ),
  component: ControlBoardPage,
});

function ControlBoardPage() {
  const t = useT();
  return (
    <AppShell>
      <RoleGate
        surface="hq"
        allow={["authority"]}
        icon={<ShieldCheck className="size-7" />}
        title={t({ bn: "এক্সিকিউটিভ এইচকিউ", en: "Executive HQ" })}
        description={t({ bn: "টিমের কাজ, লিডের অগ্রগতি ও ব্যবসার ফলাফল। প্রবেশের জন্য পিন প্রয়োজন।", en: "Team performance, lead progress and business results. PIN required to enter." })}
      >
        <ControlBoard />
      </RoleGate>
    </AppShell>
  );
}

function ControlBoard() {
  const t = useT();
  const { profiles, leads, calls, messages, events, isPending, snapshotTime, readError } = useSnapshot();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  /** Which number card / mix-card row the executive drilled into. */
  const [drill, setDrill] = useState<DrillSpec | null>(null);

  const agents = useMemo(
    () =>
      profiles.filter(
        (p) =>
          (p.role === "agent" || p.role === "team_leader") &&
          p.is_active &&
          p.approval_status === "approved",
      ),
    [profiles],
  );
  const stats = useMemo(
    () => buildAgentStats(profiles, leads, calls, messages),
    [profiles, leads, calls, messages],
  );

  const chartData = stats.map((row) => ({
    name: row.profile.name.split(" ")[0] ?? row.profile.name,
    connected: row.connected,
    talkMinutes: Math.round(row.talkSeconds / 60),
  }));

  const funnelRows = useMemo(() => {
    const order: { key: string; label: string }[] = [
      { key: "pending", label: "নতুন / বাকি" },
      { key: "contacted", label: "কথা হয়েছে" },
      { key: "follow_up", label: "ফলো-আপ" },
      { key: "closed", label: "কাজ শেষ" },
    ];
    return order.map((o) => ({
      label: o.label,
      value: leads.filter((l) => l.status === o.key).length,
      leads: leads.filter((l) => l.status === o.key),
    }));
  }, [leads]);

  const sourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = (lead.source ?? "unknown").replace(/_/g, " ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({
        label,
        value,
        leads: leads.filter((l) => (l.source ?? "unknown").replace(/_/g, " ") === label),
      }));
  }, [leads]);

  const sentimentRows = useMemo(() => {
    const labels: Record<string, string> = {
      positive: "ভালো কথো",
      neutral: "সাধারণ কথো",
      negative: "খারাপ কথো",
    };
    const counts = new Map<string, number>();
    for (const call of calls) {
      if (!call.sentiment) continue;
      counts.set(call.sentiment, (counts.get(call.sentiment) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        label: labels[key] ?? key,
        value,
        calls: calls.filter((c) => c.sentiment === key),
      }));
  }, [calls]);

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;
  const openAgent = profiles.find((p) => p.id === openAgentId) ?? null;
  const [tab, setTab] = useSection("/hq");
  const activeSection = HQ_TABS.find((item) => item.key === tab);
  const activeLabel = activeSection ? t({ bn: activeSection.label, en: activeSection.en }) : "";

  return (
    <>
      <div className="hq-luxe min-w-0 space-y-5 py-2 sm:space-y-6 sm:py-3">
        <HqHeader />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Mobile: collapsible tab menu */}
          <details className="group rounded-lg border border-border bg-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>{activeLabel}</span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <nav aria-label="HQ sections" className="flex flex-col gap-1 border-t border-border p-2">
              {HQ_TABS.map((item) => (
                <Button
                  variant="ghost"
                  key={item.key}
                  type="button"
                  onClick={(e) => {
                    setTab(item.key);
                    e.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  aria-current={tab === item.key ? "page" : undefined}
                  className={`h-auto justify-start whitespace-normal rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    tab === item.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {t({ bn: item.label, en: item.en })}
                </Button>
              ))}
            </nav>
          </details>

          {/* White content surface */}
          <div className="min-w-0 flex-1 space-y-5 text-foreground">
            <MaintenanceProfileNotice />
            <Suspense fallback={null}><SiteVisitAlerts /></Suspense>
            {tab === "kpis" && <div className="space-y-6"><Button asChild variant="secondary"><Link to="/score-versions">{t({ bn: "তারিখভিত্তিক স্কোর", en: "Dated scores" })}</Link></Button><ScoreFormulaSettings /><DailyScoresPanel /><AgentSalesScorecards /><AgentSelfLeadsPanel /><AgentKpiDashboard /></div>}
            {tab === "overview" && (
              <div className="space-y-8">
                <HqSmartSummary
                  loading={isPending}
                  profiles={profiles}
                  leads={leads}
                  calls={calls}
                  messages={messages}
                  onSelectAgent={setOpenAgentId}
                />
                <LeadPoolNotice />
                <DistributionFailurePanel />
                <SalesCommandCenter
                  snapshotTime={snapshotTime}
                  snapshotError={readError}
                  profiles={profiles}
                  leads={leads}
                  calls={calls}
                  messages={messages}
                  loading={isPending}
                  onDrill={setDrill}
                  onSelectAgent={setOpenAgentId}
                />
                <details className="group border-y border-border py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    {t({ bn: "বণ্টন ও যোগাযোগের বিস্তারিত", en: "Allocation & communication details" })}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-5 space-y-6"><DailyAllocationSummary surface="hq" /><AgentTargetPanel /><WhatsappAgentSummary /></div>
                </details>
                <SalesChartsDashboard scope="hq" />
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="min-w-0 space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold">{t({ bn: "আজকের মার্কেট ব্রিফ", en: "Today's market brief" })}</h2>
                      <Link to="/news" className="text-xs font-medium text-primary hover:underline">{t({ bn: "সব খবর →", en: "All news →" })}</Link>
                    </div>
                    <MarketNewsFeed compact />
                  </section>
                  <section className="min-w-0 space-y-3 border-t border-border pt-4">
                    <h2 className="font-semibold">{t({ bn: "প্রপার্টি ও প্রজেক্ট আপডেট", en: "Property & project updates" })}</h2>
                    <p className="text-xs text-muted-foreground">{t({ bn: "যাচাইকৃত ও প্রকাশিত তথ্য", en: "Verified, published information" })}</p>
                    <FactsBoard category="project_property" admin={false} />
                  </section>
                </div>
                <SystemManualCard />
                <SmartInsightStrip scope="floor" />
                <ExecutiveBrief />
                <details><summary className="cursor-pointer text-sm font-medium">Optional recording evidence · not agent performance</summary><div className="mt-4"><HqStatTiles calls={calls} leads={leads} messages={messages} onDrill={setDrill} /></div></details>
              </div>
            )}

            {tab === "performance" && (
              <div className="space-y-8">
                <SalesCommandCenter snapshotTime={snapshotTime} snapshotError={readError} profiles={profiles} leads={leads} calls={calls} messages={messages} loading={isPending} onDrill={setDrill} onSelectAgent={setOpenAgentId} />
                <details><summary className="cursor-pointer text-sm font-medium">Optional recording-based charts · not the operational score</summary><div className="mt-4 space-y-8">
                <ExecutiveOverview
                  profiles={profiles}
                  leads={leads}
                  calls={calls}
                  messages={messages}
                  events={events}
                  onSelectAgent={setOpenAgentId}
                />
                <AgentRadar agents={agents} calls={calls} onSelectAgent={setOpenAgentId} />
                <HqTalkChart chartData={chartData} />
                <Leaderboard stats={stats} onSelectAgent={setOpenAgentId} />
                </div></details>
              </div>
            )}

            {tab === "leads" && (
              <div className="space-y-8">
                <HqClassificationTiles leads={leads} onDrill={setDrill} />
                <HqMixCards
                  funnelRows={funnelRows}
                  sourceRows={sourceRows}
                  sentimentRows={sentimentRows}
                  loading={isPending}
                  onDrill={setDrill}
                />
                <HqRecentSummaries
                  calls={calls}
                  leads={leads}
                  profiles={profiles}
                  onSelectLead={setOpenLeadId}
                />
              </div>
            )}

            {tab === "followups" && <div className="space-y-4"><ConversationOutcomesPanel /><ReportsBoard /></div>}

            {tab === "lead360" && <Lead360Workspace />}
            {tab === "audit" && <Suspense fallback={<SnapshotSkeleton />}><DailyAgentAudit /></Suspense>}
            {tab === "recovery" && <Suspense fallback={<SnapshotSkeleton />}><div className="space-y-6"><ClosureRecoveryQueue onOpenLead={setOpenLeadId} /><VipRecoveryQueue onOpenLead={setOpenLeadId} /></div></Suspense>}

            {tab === "tools" && (
              <div className="space-y-8">
                <SystemManualCard />
                <AccountabilityReviewPanel surface="hq" />
                <NeglectDisputePanel />
                <SocialHqPanel />
                <FloorLockAdminPanel />
                <ShiftSummaryPanel scope="hq" />
                <CommandAgentPanel surface="hq" />
                <AskHqPanel />
              </div>
            )}
          </div>
        </div>
      </div>

      <LeadDossier
        lead={openLead}
        agents={profiles}
        timeline={openLead ? buildTimeline(calls, messages, openLead.id, events) : []}
        open={openLeadId !== null}
        onOpenChange={(next) => !next && setOpenLeadId(null)}
      />
      <AgentDossier
        agent={openAgent}
        leads={leads}
        calls={calls}
        messages={messages}
        open={openAgentId !== null}
        onOpenChange={(next) => !next && setOpenAgentId(null)}
      />
      <HqDrillSheet
        spec={drill}
        profiles={profiles}
        leads={leads}
        loading={isPending}
        open={drill !== null}
        onOpenChange={(next) => !next && setDrill(null)}
        onSelectLead={(leadId) => {
          setDrill(null);
          setOpenLeadId(leadId);
        }}
      />
    </>
  );
}
