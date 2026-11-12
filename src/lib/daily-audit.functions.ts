import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ adminToken: z.string().nullable().optional(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * HQ + IT, read-only: every active agent's leads, calls, follow-ups and overdue
 * work for one Dhaka day, measured with the same rule as the 10% accountability
 * review. Nothing is written — no reviews are created from this page.
 */
export const getDailyAgentAudit = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { dhakaDate, dhakaDayBounds } = await import("@/lib/accountability");
    const { auditableDay } = await import("@/lib/daily-audit");
    const today = dhakaDate(0);
    if (!auditableDay(data.day, today)) throw new Error("Choose a day between 28 Sep 2026 and today (Dhaka)");
    const { isBusinessDay } = await import("@/lib/business-day");
    const { activeAgents } = await import("@/lib/lead-pool.server");
    const { measureAgentDay } = await import("@/lib/accountability.server");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { start, end } = dhakaDayBounds(data.day);
    const agents = await activeAgents();
    const ids = agents.map((a) => a.id);

    const startedInDay = `and(call_started_at.gte.${start},call_started_at.lte.${end}),and(call_started_at.is.null,created_at.gte.${start},created_at.lte.${end})`;
    const none = Promise.resolve({ data: [], error: null });
    const [calls, reports, reviews, locks, received] = await Promise.all([
      ids.length
        ? db.from("call_reports").select("agent_id, lead_id").in("agent_id", ids).or(startedInDay).limit(10000)
        : none,
      ids.length
        ? db.from("call_reports").select("agent_id, lead_id, category, connected").in("agent_id", ids).eq("status", "submitted").gte("submitted_at", start).lte("submitted_at", end).limit(10000)
        : none,
      ids.length
        ? db.from("agent_accountability_reviews").select("agent_id, status").in("agent_id", ids).eq("business_date", data.day)
        : none,
      ids.length
        ? db.from("agent_accountability_reviews").select("agent_id").in("agent_id", ids).eq("unlock_for_date", data.day).neq("status", "approved")
        : none,
      ids.length
        ? db.from("lead_daily_assignment_ledger").select("agent_id").in("agent_id", ids).eq("work_date", data.day).limit(10000)
        : none,
    ]);
    if (calls.error || reports.error || reviews.error || locks.error || received.error) throw new Error("Daily audit evidence unavailable");
    if ((calls.data ?? []).length >= 10000 || (reports.data ?? []).length >= 10000 || (received.data ?? []).length >= 10000) throw new Error("Daily audit evidence truncated");
    const tally = (rows: { agent_id: string | null }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) if (r.agent_id) m.set(r.agent_id, (m.get(r.agent_id) ?? 0) + 1);
      return m;
    };
    const group = <T extends { agent_id: string | null }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const r of rows) if (r.agent_id) m.set(r.agent_id, [...(m.get(r.agent_id) ?? []), r]);
      return m;
    };
    const callsBy = group((calls.data ?? []) as { agent_id: string | null; lead_id: string | null }[]);
    const reportRows = (reports.data ?? []) as { agent_id: string | null; lead_id: string | null; category: string | null; connected: boolean | null }[];
    const reportsBy = tally(reportRows);
    const closuresBy = group(reportRows);
    const reviewBy = new Map((reviews.data ?? []).map((r) => [r.agent_id, r.status as string]));
    const lockedIds = new Set((locks.data ?? []).map((r) => r.agent_id));
    const receivedBy = tally((received.data ?? []) as { agent_id: string | null }[]);
    const { closureCounts, explainAssignment } = await import("@/lib/daily-audit");

    // Backlog and the Net-50 allowance exist only "as of now", so they are shown for today only.
    const isToday = data.day === today;
    let backlogBy: Map<string, number> | null = null;
    let cap = { enabled: true, limit: 50 };
    let paused = false;
    if (isToday && ids.length) {
      const { pendingBacklogByAgent } = await import("@/lib/lead-pool.server");
      const { BACKLOG_CAP_CONFIG_ID, AUTO_PAUSE_CONFIG_ID, readBacklogCap, isAutoDistributionPaused } = await import("@/lib/backlog-cap");
      const [b, capRow, pauseRow] = await Promise.all([
        pendingBacklogByAgent(ids, data.day),
        db.from("app_config").select("data").eq("id", BACKLOG_CAP_CONFIG_ID).maybeSingle(),
        db.from("app_config").select("data").eq("id", AUTO_PAUSE_CONFIG_ID).maybeSingle(),
      ]);
      if (capRow.error || pauseRow.error) throw new Error("Distribution settings unavailable");
      backlogBy = b;
      cap = readBacklogCap(capRow.data?.data);
      paused = isAutoDistributionPaused(data.day, pauseRow.data?.data ?? null);
    }
    const { DAILY_COMPANY_QUOTA } = await import("@/lib/daily-audit");

    const rows = await Promise.all(
      agents.map(async (a) => {
        const m = await measureAgentDay(a.id, data.day);
        const ev = m.evidence as { backlog_followups?: number; excluded_followups?: unknown[]; overdue_followups?: { id: string; scheduled_at: string; customer: string | null }[] };
        return {
          agentId: a.id,
          name: a.name,
          employeeId: a.employee_id,
          assigned: m.assigned,
          completed: m.completed,
          eligible: m.eligible,
          pending: m.pending,
          pendingPercent: m.pendingPercent,
          dueFollowUps: m.eligible - m.assigned,
          overdueFollowUps: m.overdueFollowUps,
          excludedFollowUps: ev.excluded_followups?.length ?? 0,
          backlogFollowUps: ev.backlog_followups ?? 0,
          missedReports: m.missedReports,
          callsLogged: (callsBy.get(a.id) ?? []).length,
          leadsCalled: new Set((callsBy.get(a.id) ?? []).map((c) => c.lead_id).filter(Boolean)).size,
          reportsSubmitted: reportsBy.get(a.id) ?? 0,
          incompleteReportsCounted: m.incompleteReportsCounted,
          ...closureCounts(closuresBy.get(a.id) ?? []),
          receivedToday: receivedBy.get(a.id) ?? 0,
          olderBacklog: backlogBy ? backlogBy.get(a.id) ?? 0 : null,
          // Today's company leads still pending = pending work minus overdue follow-ups and counted reports.
          todayPendingLeads: Math.max(0, m.pending - m.overdueFollowUps - m.incompleteReportsCounted),
          assignment: backlogBy
            ? explainAssignment({ businessDay: isBusinessDay(data.day), paused, reviewLocked: lockedIds.has(a.id), backlog: backlogBy.get(a.id) ?? 0, quota: DAILY_COMPANY_QUOTA, cap })
            : null,
          flagged: m.flagged,
          reason: m.reason,
          reviewStatus: reviewBy.get(a.id) ?? null,
          overdueList: (ev.overdue_followups ?? []).slice(0, 20).map((f) => ({ id: f.id, scheduledAt: f.scheduled_at, customer: f.customer })),
        };
      }),
    );
    rows.sort((x, y) => y.pendingPercent - x.pendingPercent || x.name.localeCompare(y.name));
    return { day: data.day, today, businessDay: isBusinessDay(data.day), measuredAt: new Date().toISOString(), rows };
  });
