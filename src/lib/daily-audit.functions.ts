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

    const [calls, reports, reviews] = await Promise.all([
      ids.length
        ? db.from("call_reports").select("agent_id").in("agent_id", ids).gte("created_at", start).lte("created_at", end).limit(10000)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? db.from("call_reports").select("agent_id").in("agent_id", ids).eq("status", "submitted").gte("submitted_at", start).lte("submitted_at", end).limit(10000)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? db.from("agent_accountability_reviews").select("agent_id, status").in("agent_id", ids).eq("business_date", data.day)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (calls.error || reports.error || reviews.error) throw new Error("Daily audit evidence unavailable");
    if ((calls.data ?? []).length >= 10000 || (reports.data ?? []).length >= 10000) throw new Error("Daily audit evidence truncated");
    const tally = (rows: { agent_id: string | null }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) if (r.agent_id) m.set(r.agent_id, (m.get(r.agent_id) ?? 0) + 1);
      return m;
    };
    const callsBy = tally(calls.data ?? []);
    const reportsBy = tally(reports.data ?? []);
    const reviewBy = new Map((reviews.data ?? []).map((r) => [r.agent_id, r.status as string]));

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
          callsLogged: callsBy.get(a.id) ?? 0,
          reportsSubmitted: reportsBy.get(a.id) ?? 0,
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
