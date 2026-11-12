import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { scoreFormulaSchema } from "./score-formula";

const CONFIG_ID = "daily_score_formula";
const token = z.object({ adminToken: z.string().nullable().optional() });

async function gate(adminToken: string | null | undefined, write: boolean) {
  const { resolveCaller, requireBookingReviewer, requireAuthority } = await import("./access.server");
  const caller = await resolveCaller(adminToken);
  if (write) await requireBookingReviewer(caller, adminToken); else requireAuthority(caller);
  return caller;
}

export const readScoreFormula = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => token.parse(v))
  .handler(async ({ data }) => {
    await gate(data.adminToken, false);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.from("app_config").select("data").eq("id", CONFIG_ID).maybeSingle();
    if (r.error) throw new Error("Score settings unavailable");
    const d = (r.data?.data ?? null) as { current?: unknown; savedAt?: string; savedBy?: string; history?: unknown[] } | null;
    const parsed = scoreFormulaSchema.safeParse(d?.current);
    return { formula: parsed.success ? parsed.data : null, savedAt: d?.savedAt ?? null, savedBy: d?.savedBy ?? null, versions: d?.history?.length ?? 0 };
  });

export const saveScoreFormula = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => token.extend({ formula: scoreFormulaSchema }).parse(v))
  .handler(async ({ data }) => {
    const caller = await gate(data.adminToken, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prev = await supabaseAdmin.from("app_config").select("data").eq("id", CONFIG_ID).maybeSingle();
    if (prev.error) throw new Error("Score settings unavailable");
    const old = (prev.data?.data ?? {}) as { current?: unknown; savedAt?: string; savedBy?: string; history?: unknown[] };
    const savedAt = new Date().toISOString();
    const savedBy = caller.profile?.name ?? (caller.readOnly ? "Executive HQ" : "IT Console");
    // Keep every earlier version — settings history is never overwritten.
    const history = [...(old.history ?? []), ...(old.current ? [{ formula: old.current, savedAt: old.savedAt, savedBy: old.savedBy }] : [])];
    const w = await supabaseAdmin.from("app_config").upsert({ id: CONFIG_ID, data: JSON.parse(JSON.stringify({ current: data.formula, savedAt, savedBy, history })) });
    if (w.error) throw new Error("Could not save score settings");
    return { ok: true, savedAt };
  });

const dayInput = token.extend({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
/** Read-only daily scores for every agent on one Dhaka day, using the saved formula. */
export const readDailyScores = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => dayInput.parse(v))
  .handler(async ({ data }) => {
    await gate(data.adminToken, false);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("./page-all");
    const { dhakaRangeToUtc } = await import("./import-funnel");
    const { dailyScores } = await import("./daily-score");
    const cfg = await db.from("app_config").select("data").eq("id", CONFIG_ID).maybeSingle();
    if (cfg.error) throw new Error("Score settings unavailable");
    const parsed = scoreFormulaSchema.safeParse((cfg.data?.data as { current?: unknown } | null)?.current);
    if (!parsed.success) return { formula: null, rows: [], day: data.day, generatedAt: new Date().toISOString() };
    const { startIso: s, endIso: e } = dhakaRangeToUtc(data.day, data.day);
    const [agents, calls, reports, visits, followUps, bookings, visitsHeld] = await Promise.all([
      pageAllParallel((a, b) => db.from("profiles").select("id,name").in("role", ["agent", "team_leader"]).order("id").range(a, b)),
      pageAllParallel((a, b) => db.from("call_recordings").select("id,agent_id,lead_id,call_status,duration_seconds,call_source,external_call_id,talk_time_source").gte("started_at", s).lt("started_at", e).order("id").range(a, b)),
      pageAllParallel((a, b) => db.from("call_reports").select("id,agent_id,lead_id").eq("status", "submitted").gte("submitted_at", s).lt("submitted_at", e).order("id").range(a, b)),
      pageAllParallel((a, b) => db.from("site_visits").select("id,agent_id,lead_id").neq("status", "cancelled").gte("created_at", s).lt("created_at", e).order("id").range(a, b)),
      pageAllParallel((a, b) => db.from("follow_up_events").select("id,agent_id,lead_id,scheduled_at,completed_at").gte("completed_at", s).lt("completed_at", e).order("id").range(a, b)),
      pageAllParallel((a, b) => db.from("bookings").select("id,agent_id,lead_id").eq("approval_status", "approved").gte("reviewed_at", s).lt("reviewed_at", e).order("id").range(a, b)),
      pageAllParallel((a, b) => db.from("site_visits").select("id,agent_id,lead_id,status").gte("visit_at", s).lt("visit_at", e).order("id").range(a, b)),
    ]);
    if ([agents, calls, reports, visits, followUps, bookings, visitsHeld].some((r) => r.error)) throw new Error("Score evidence unavailable. Please refresh.");
    const leadIds = [...new Set([calls, reports, visits, followUps, bookings, visitsHeld].flatMap((r) => (r.data ?? []).map((x: { lead_id: string | null }) => x.lead_id).filter(Boolean) as string[]))];
    const selfLeadIds = new Set<string>();
    for (let i = 0; i < leadIds.length; i += 200) {
      const r = await db.from("leads").select("id").in("id", leadIds.slice(i, i + 200)).eq("assignment_source", "self");
      if (r.error) throw new Error("Score evidence unavailable. Please refresh.");
      for (const l of r.data ?? []) selfLeadIds.add(l.id);
    }
    const rows = dailyScores(parsed.data, { agents: agents.data ?? [], selfLeadIds, calls: calls.data ?? [], reports: reports.data ?? [], visits: visits.data ?? [], followUps: followUps.data ?? [], bookings: bookings.data ?? [], visitsHeld: visitsHeld.data ?? [] });
    return { formula: parsed.data, rows, day: data.day, generatedAt: new Date().toISOString() };
  });
