import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const input = z.object({ adminToken: z.string().nullable().optional(), from: day, to: day, agentId: z.string().uuid().nullable().optional() })
  .refine((v) => v.from <= v.to, "Start date must be on or before end date")
  .refine((v) => Date.parse(v.to) - Date.parse(v.from) < 31 * 864e5, "Choose at most 31 days");

/** HQ/IT PIN only, read-only: real synced call rows, call-log confirmation, AI summary text. No audio. */
export const readCallRecords = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => input.parse(v))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("./access.server");
    requireAuthority(await resolveCaller(data.adminToken));
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("./page-all");
    const { dhakaRangeToUtc } = await import("./import-funnel");
    const { isCallLogConfirmed, confirmedLeadsPerDay } = await import("./call-log-confirmed");
    const { maskPhone } = await import("./agent-self-leads");
    const { startIso, endIso } = dhakaRangeToUtc(data.from, data.to);
    const [calls, agents] = await Promise.all([
      pageAllParallel((a, b) => {
        let q = db.from("call_recordings").select("id,agent_id,lead_id,phone_number,call_direction,call_status,call_source,duration_seconds,talk_time_source,started_at,created_at,ai_summary").gte("created_at", startIso).lt("created_at", endIso);
        if (data.agentId) q = q.eq("agent_id", data.agentId);
        return q.order("id").range(a, b);
      }),
      pageAllParallel((a, b) => db.from("profiles").select("id,name").in("role", ["agent", "team_leader"]).order("id").range(a, b)),
    ]);
    if (calls.error || agents.error) throw new Error("Call records unavailable. Please refresh.");
    const names = new Map((agents.data ?? []).map((a) => [a.id, a.name ?? "Agent"]));
    const rows = (calls.data ?? []).map((c) => ({
      id: c.id, agentId: c.agent_id, agent: names.get(c.agent_id ?? "") ?? "Unknown agent", leadId: c.lead_id,
      phone: maskPhone(c.phone_number), direction: c.call_direction, status: c.call_status, source: c.call_source,
      seconds: c.duration_seconds, at: c.started_at ?? c.created_at, confirmed: isCallLogConfirmed(c),
      summary: c.ai_summary ? String(c.ai_summary).slice(0, 600) : null,
    })).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    const byAgent = new Map<string, { agentId: string; agent: string; calls: number; confirmed: number }>();
    for (const r of rows) {
      const k = r.agentId ?? "none";
      const e = byAgent.get(k) ?? { agentId: k, agent: r.agent, calls: 0, confirmed: 0 };
      e.calls++; if (r.confirmed) e.confirmed++; byAgent.set(k, e);
    }
    return {
      rows, perAgent: [...byAgent.values()].sort((a, b) => b.confirmed - a.confirmed),
      leadsPerDay: confirmedLeadsPerDay(calls.data ?? []),
      agents: (agents.data ?? []).map((a) => ({ id: a.id, name: a.name ?? "Agent" })),
      generatedAt: new Date().toISOString(),
    };
  });
