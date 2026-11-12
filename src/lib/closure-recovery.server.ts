/** Server-only reader for the closure recovery queue. No writes. */
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { pageAllParallel } from "./page-all";
import { dhakaRangeToUtc } from "./import-funnel";
import { closingReportOf, isOutOfScope, measureClosure, type CallRow, type ClosingReport } from "./closure-attempts";

const fail = () => new Error("Closure evidence unavailable. Nothing is shown as complete — refresh to retry.");

function chunks<T>(items: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function readClosureQueue(from: string, to: string) {
  const { startIso, endIso } = dhakaRangeToUtc(from, to);
  // Contact-close reports submitted in the range (no follow-up set).
  const closes = await pageAllParallel((a, b) => db.from("call_reports")
    .select("id,lead_id")
    .eq("status", "submitted").is("follow_up_at", null)
    .gte("submitted_at", startIso).lt("submitted_at", endIso)
    .order("id").range(a, b));
  if (closes.error) throw fail();
  const leadIds = [...new Set((closes.data ?? []).map(r => r.lead_id).filter((v): v is string => Boolean(v)))];

  const leads: { id: string; name: string | null; status: string; source: string | null }[] = [];
  type ReportRow = ClosingReport & { follow_up_at: string | null; connection_verified: boolean | null; recording_id: string | null };
  const reports: ReportRow[] = [];
  const calls: CallRow[] = [];
  // Up to four id-chunks in flight at once; any failed read fails the whole list.
  const groups = chunks(leadIds);
  for (let i = 0; i < groups.length; i += 4) {
    const batch = await Promise.all(groups.slice(i, i + 4).map(ids => Promise.all([
      db.from("leads").select("id,name,status,source").in("id", ids).eq("status", "closed"),
      pageAllParallel((a, b) => db.from("call_reports")
        .select("id,lead_id,agent_id,submitted_at,category,connected,no_follow_up_reason,status,follow_up_at,connection_verified,recording_id")
        .in("lead_id", ids).eq("status", "submitted").order("id").range(a, b), { concurrency: 1 }),
      pageAllParallel((a, b) => db.from("call_recordings")
        .select("id,lead_id,agent_id,call_source,call_status,duration_seconds,talk_time_source,external_call_id,created_at")
        .in("lead_id", ids).order("id").range(a, b), { concurrency: 1 }),
    ])));
    for (const [l, r, c] of batch) {
      if (l.error || r.error || c.error) throw fail();
      leads.push(...(l.data ?? []));
      reports.push(...((r.data ?? []) as ReportRow[]));
      calls.push(...((c.data ?? []) as CallRow[]));
    }
  }

  const byLead = new Map<string, typeof reports>();
  for (const r of reports) {
    const list = byLead.get(r.lead_id) ?? [];
    list.push(r);
    byLead.set(r.lead_id, list);
  }
  const callsByLead = new Map<string, CallRow[]>();
  for (const c of calls) {
    if (!c.lead_id) continue;
    const list = callsByLead.get(c.lead_id) ?? [];
    list.push(c);
    callsByLead.set(c.lead_id, list);
  }

  const agentIds = new Set<string>();
  type Row = { leadId: string; name: string; source: string; agentId: string | null; closedAt: string; reason: string | null; category: string | null; connectedClaim: boolean } & ReturnType<typeof measureClosure>;
  const rows: Row[] = [];
  let checked = 0;
  let outOfScope = 0;
  for (const lead of leads) {
    const list = byLead.get(lead.id) ?? [];
    const closing = closingReportOf(list, (r) => r.follow_up_at === null);
    if (!closing || !closing.submitted_at || closing.submitted_at < startIso || closing.submitted_at >= endIso) continue;
    if (isOutOfScope(closing)) { outOfScope += 1; continue; }
    checked += 1;
    const before = list.filter(r => String(r.submitted_at ?? "") <= closing.submitted_at!);
    const gap = measureClosure({ closing, reportsBefore: before.length, calls: callsByLead.get(lead.id) ?? [], verifiedReports: before.filter(r => r.connection_verified === true) });
    if (!gap.short) continue;
    if (closing.agent_id) agentIds.add(closing.agent_id);
    rows.push({ leadId: lead.id, name: lead.name ?? "—", source: lead.source ?? "unknown", agentId: closing.agent_id, closedAt: closing.submitted_at,
      reason: closing.no_follow_up_reason, category: closing.category, connectedClaim: Boolean(closing.connected), ...gap });
  }

  const names = new Map<string, string>();
  for (const ids of chunks([...agentIds])) {
    const p = await db.from("profiles").select("id,name").in("id", ids);
    if (p.error) throw fail();
    for (const x of p.data ?? []) names.set(x.id, x.name ?? "Unknown agent");
  }
  rows.sort((a, b) => b.closedAt.localeCompare(a.closedAt) || a.leadId.localeCompare(b.leadId));
  return {
    from, to, readAt: new Date().toISOString(),
    totals: {
      checked, outOfScope, queued: rows.length,
      unreachable: rows.filter(r => r.kind === "unreachable").length,
      conversation: rows.filter(r => r.kind === "conversation").length,
    },
    rows: rows.map(r => ({ ...r, agentName: r.agentId ? names.get(r.agentId) ?? "Unknown agent" : "Unknown agent" })),
  };
}
