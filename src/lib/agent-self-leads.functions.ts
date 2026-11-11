import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const input = z.object({ adminToken: z.string().nullable().optional(), from: day, to: day })
  .refine(v => v.from <= v.to, "From must not follow To")
  .refine(v => Date.parse(v.to) - Date.parse(v.from) < 92 * 864e5, "Choose at most 92 days");

/** Read-only: every lead an agent added themselves, plus today's company-task progress. */
export const readAgentSelfLeads = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("./page-all");
    const { dhakaRangeToUtc } = await import("./import-funnel");
    const { dhakaDateOf } = await import("./business-day");
    const { summarizeAgents, maskPhone } = await import("./agent-self-leads");
    const { startIso, endIso } = dhakaRangeToUtc(data.from, data.to);
    const today = dhakaDateOf();

    const leads = await pageAllParallel((a, b) => db.from("leads")
      .select("id,name,phone_number,status,assigned_to,assigned_agent_id,created_at")
      .eq("assignment_source", "self").gte("created_at", startIso).lt("created_at", endIso)
      .order("id").range(a, b));
    if (leads.error) throw new Error("Own leads unavailable. Please refresh.");
    const own = leads.data ?? [];
    const ids = own.map(l => l.id);

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
    const [reports, classes, follows] = await Promise.all([
      Promise.all(chunks.map(c => db.from("call_reports").select("lead_id,status,submitted_at,customer_response").in("lead_id", c).eq("status", "submitted").limit(5000))),
      Promise.all(chunks.map(c => db.from("lead_classifications").select("lead_id,temperature,classified_at").in("lead_id", c).limit(5000))),
      Promise.all(chunks.map(c => db.from("follow_up_events").select("lead_id").in("lead_id", c).limit(5000))),
    ]);
    if ([...reports, ...classes, ...follows].some(r => r.error)) throw new Error("Own lead history unavailable. Please refresh.");
    const lastOutcome = new Map<string, { at: string; v: string | null }>();
    for (const r of reports.flatMap(x => (x.data ?? []) as { lead_id: string; submitted_at: string | null; customer_response: string | null }[])) {
      const prev = lastOutcome.get(r.lead_id);
      if (!prev || (r.submitted_at ?? "") > prev.at) lastOutcome.set(r.lead_id, { at: r.submitted_at ?? "", v: r.customer_response });
    }
    const temp = new Map<string, { at: string; v: string | null }>();
    for (const c of classes.flatMap(x => x.data ?? [])) {
      const prev = temp.get(c.lead_id);
      if (!prev || (c.classified_at ?? "") > prev.at) temp.set(c.lead_id, { at: c.classified_at ?? "", v: c.temperature });
    }
    const fu = new Map<string, number>();
    for (const f of follows.flatMap(x => x.data ?? [])) fu.set(f.lead_id, (fu.get(f.lead_id) ?? 0) + 1);

    // Today's mandatory company work (everything assigned today that is not self-added).
    const company = await pageAllParallel((a, b) => db.from("leads")
      .select("id,assigned_to,assignment_source,status")
      .eq("work_date", today).not("assigned_to", "is", null)
      .order("id").range(a, b));
    if (company.error) throw new Error("Company task progress unavailable. Please refresh.");
    const compRows = (company.data ?? []).filter(l => l.assignment_source !== "self" && l.assignment_source !== "duplicate_skipped");
    const compIds = compRows.map(l => l.id);
    const doneIds = new Set<string>();
    for (let i = 0; i < compIds.length; i += 200) {
      const r = await db.from("call_reports").select("lead_id").in("lead_id", compIds.slice(i, i + 200)).eq("status", "submitted").gte("submitted_at", dhakaRangeToUtc(today, today).startIso).limit(5000);
      if (r.error) throw new Error("Company task progress unavailable. Please refresh.");
      for (const x of r.data ?? []) doneIds.add(x.lead_id);
    }
    const compAgg = new Map<string, { agentId: string; total: number; done: number }>();
    for (const l of compRows) {
      const id = l.assigned_to as string;
      const a = compAgg.get(id) ?? { agentId: id, total: 0, done: 0 };
      a.total++; if (doneIds.has(l.id)) a.done++;
      compAgg.set(id, a);
    }

    const agentIds = [...new Set([...own.map(l => (l.assigned_to ?? l.assigned_agent_id) as string).filter(Boolean), ...compAgg.keys()])];
    const prof = agentIds.length ? await db.from("profiles").select("id,name").in("id", agentIds) : { data: [], error: null };
    if (prof.error) throw new Error("Agent names unavailable.");
    const names = new Map((prof.data ?? []).map(p => [p.id, p.name ?? "—"]));

    const rows = own.map(l => ({
      id: l.id, name: l.name, phone: maskPhone(l.phone_number),
      agentId: (l.assigned_to ?? l.assigned_agent_id) as string, agentName: names.get((l.assigned_to ?? l.assigned_agent_id) as string) ?? "—",
      status: l.status, createdAt: l.created_at,
      lastOutcome: lastOutcome.get(l.id)?.v ?? null, temperature: temp.get(l.id)?.v ?? null, followUps: fu.get(l.id) ?? 0,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { rows, agents: summarizeAgents(rows, [...compAgg.values()], names), today, generatedAt: new Date().toISOString() };
  });
