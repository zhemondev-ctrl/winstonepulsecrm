import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => {
  const date = new Date(`${d}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === d;
}, "Invalid calendar date");
const input = z.object({ adminToken: z.string().nullable().optional(), from: day, to: day })
  .refine(v => v.from <= v.to, "From must not follow To")
  .refine(v => Date.parse(v.to) - Date.parse(v.from) < 92 * 864e5, "Choose at most 92 days");

const sourceInput = z.object({ adminToken: z.string().nullable().optional(), agentId: z.string().uuid(), bucket: z.enum(["companyDatabase", "selfAssigned", "unknownSource", "otherSource"]) });
const trendInput = z.object({ adminToken: z.string().nullable().optional(), agentId: z.string().uuid(), from: day, to: day })
  .refine(v => v.from <= v.to, "From must not follow To")
  .refine(v => Date.parse(v.to) - Date.parse(v.from) < 92 * 864e5, "Choose at most 92 days");
export const readAgentSourceTrend = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => trendInput.parse(value))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("./page-all");
    const { agentSourceTrend } = await import("./agent-sales-scorecard");
    const [leads, assignments] = await Promise.all([
      pageAllParallel((a,b) => db.from("leads").select("id,source,assignment_source,assigned_to,assigned_agent_id")
        .or(`assigned_to.eq.${data.agentId},and(assigned_to.is.null,assigned_agent_id.eq.${data.agentId})`).order("id").range(a,b)),
      pageAllParallel((a,b) => db.from("lead_assignments").select("id,lead_id,to_agent_id,created_at").eq("to_agent_id", data.agentId).order("id").range(a,b)),
    ]);
    if (leads.error || assignments.error) throw new Error("Source trend unavailable. Please refresh.");
    return { ...agentSourceTrend(leads.data ?? [], assignments.data ?? [], data.agentId, data.from, data.to), generatedAt: new Date().toISOString() };
  });
export const readAgentSourceLeads = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => sourceInput.parse(value))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("./page-all");
    const { agentSourceLeads } = await import("./agent-sales-scorecard");
    const result = await pageAllParallel((a,b) => db.from("leads")
      .select("id,name,phone_number,status,source,assignment_source,assigned_to,assigned_agent_id")
      .or(`assigned_to.eq.${data.agentId},and(assigned_to.is.null,assigned_agent_id.eq.${data.agentId})`)
      .order("id").range(a,b));
    if (result.error) throw new Error("Source leads unavailable. Please refresh.");
    return { rows: agentSourceLeads(result.data ?? [], data.agentId, data.bucket)
      .map(l => ({ id: l.id, name: l.name, phone: l.phone_number, status: l.status, source: l.source }))
      .sort((a,b) => (a.name ?? "").localeCompare(b.name ?? "") || a.id.localeCompare(b.id)), generatedAt: new Date().toISOString() };
  });

export const readAgentSalesScorecards = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("./page-all");
    const { dhakaRangeToUtc } = await import("./import-funnel");
    const { agentSalesScorecards } = await import("./agent-sales-scorecard");
    const { startIso, endIso } = dhakaRangeToUtc(data.from, data.to);
    const [agents, leads, reports, bookings, visits] = await Promise.all([
      pageAllParallel((a,b) => db.from("profiles").select("id,name").in("role", ["agent","team_leader"]).order("id").range(a,b)),
      pageAllParallel((a,b) => db.from("leads").select("id,assigned_to,assigned_agent_id,status,outcome_category,assignment_source,source").order("id").range(a,b)),
      pageAllParallel((a,b) => db.from("call_reports").select("id,lead_id,agent_id,submitted_at,category,temperature").eq("status","submitted").lt("submitted_at",endIso).order("id").range(a,b)),
      pageAllParallel((a,b) => db.from("bookings").select("id,lead_id,agent_id,booked_at,status,approval_status").gte("booked_at",startIso).lt("booked_at",endIso).order("id").range(a,b)),
      pageAllParallel((a,b) => db.from("site_visits").select("id,lead_id,agent_id,created_at,status").gte("created_at",startIso).lt("created_at",endIso).order("id").range(a,b)),
    ]);
    if ([agents,leads,reports,bookings,visits].some(r => r.error)) throw new Error("Scorecard evidence unavailable. Please refresh.");
    return { rows: agentSalesScorecards({ agents: agents.data ?? [], leads: leads.data ?? [], reports: reports.data ?? [], bookings: bookings.data ?? [], visits: visits.data ?? [] },startIso,endIso), generatedAt: new Date().toISOString() };
  });