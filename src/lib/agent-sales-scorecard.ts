import { leadOwner } from "./lead-owner";

type Agent = { id: string; name: string };
type Lead = { id: string; assigned_to: string | null; assigned_agent_id: string | null; status: string; outcome_category: string | null; assignment_source: string | null; source?: string | null };
type Report = { id: string; lead_id: string | null; agent_id: string | null; submitted_at: string | null; category: string | null; temperature: string | null };
type Booking = { id: string; lead_id: string; agent_id: string | null; booked_at: string; status: string; approval_status: string };
type Visit = { id: string; lead_id: string; agent_id: string | null; created_at: string; status: string };
export type ScorecardInput = { agents: Agent[]; leads: Lead[]; reports: Report[]; bookings: Booking[]; visits: Visit[] };
export type AgentSalesScorecard = { agentId: string; name: string; assigned: number; converted: number; conversionRate: number | null; visits: number; hotLost: number; companyDatabase: number; selfAssigned: number; unknownSource: number; otherSource: number };

const unique = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map(r => [r.id, r])).values()];

export type LeadSourceBucket = "companyDatabase" | "selfAssigned" | "unknownSource" | "otherSource";
export function leadSourceBucket(lead: { source?: string | null; assignment_source: string | null }): LeadSourceBucket {
  if (["head_database", "public_directory"].includes(lead.source ?? "")) return "companyDatabase";
  if (lead.source === "agent_app" || lead.assignment_source === "self") return "selfAssigned";
  if (!lead.source || ["unknown", "unrecorded"].includes(lead.source)) return "unknownSource";
  return "otherSource";
}
export function agentSourceLeads<T extends { id: string; assigned_to: string | null; assigned_agent_id: string | null; source?: string | null; assignment_source: string | null }>(leads: T[], agentId: string, bucket: LeadSourceBucket): T[] {
  return unique(leads).filter(l => l.assignment_source !== "duplicate_skipped" && leadOwner(l) === agentId && leadSourceBucket(l) === bucket);
}

export type SourceTrendPoint = { period: string; companyDatabase: number; selfAssigned: number; unknownSource: number; otherSource: number };
export type SourceTrend = { granularity: "day" | "week"; points: SourceTrendPoint[]; undated: Record<LeadSourceBucket, number>; outsideRange: number };
type TrendLead = { id: string; assigned_to: string | null; assigned_agent_id: string | null; source?: string | null; assignment_source: string | null };
type TrendAssignment = { id: string; lead_id: string; to_agent_id: string | null; created_at: string };
const dhakaDay = (iso: string) => new Date(Date.parse(iso) + 6 * 3_600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * Current-portfolio leads, dated by the latest saved assignment to the current
 * owner (Dhaka day). Leads without such a record are reported as undated —
 * never placed on an invented date. Weekly periods start on the range's first day.
 */
export function agentSourceTrend(leads: TrendLead[], assignments: TrendAssignment[], agentId: string, from: string, to: string): SourceTrend {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error("Invalid trend dates");
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;
  const granularity = days > 31 ? "week" : "day";
  const step = granularity === "week" ? 7 : 1;
  const points: SourceTrendPoint[] = [];
  for (let i = 0; i < days; i += step) points.push({ period: addDays(from, i), companyDatabase: 0, selfAssigned: 0, unknownSource: 0, otherSource: 0 });
  const latest = new Map<string, string>();
  for (const a of unique(assignments)) {
    if (a.to_agent_id !== agentId) continue;
    const prior = latest.get(a.lead_id);
    if (!prior || a.created_at > prior) latest.set(a.lead_id, a.created_at);
  }
  const undated: Record<LeadSourceBucket, number> = { companyDatabase: 0, selfAssigned: 0, unknownSource: 0, otherSource: 0 };
  let outsideRange = 0;
  for (const lead of unique(leads)) {
    if (lead.assignment_source === "duplicate_skipped" || leadOwner(lead) !== agentId) continue;
    const bucket = leadSourceBucket(lead);
    const at = latest.get(lead.id);
    if (!at) { undated[bucket]++; continue; }
    const day = dhakaDay(at);
    if (day < from || day > to) { outsideRange++; continue; }
    const index = Math.floor(Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) / step);
    const point = points[index];
    if (point) point[bucket]++;
  }
  return { granularity, points, undated, outsideRange };
}

/** Current portfolio denominator; period outcomes; confirmed same-agent Hot → rejection only. */
export function agentSalesScorecards(input: ScorecardInput, start: string, end: string): AgentSalesScorecard[] {
  if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || start >= end) throw new Error("Invalid scorecard dates");
  const within = (at: string) => at >= start && at < end;
  const leads = unique(input.leads).filter(l => l.assignment_source !== "duplicate_skipped");
  const reports = unique(input.reports).filter(r => r.submitted_at).sort((a,b) => String(a.submitted_at).localeCompare(String(b.submitted_at)) || a.id.localeCompare(b.id));
  const history = new Map<string, Report[]>();
  for (const report of reports) {
    if (!report.lead_id || !report.agent_id) continue;
    const key = `${report.agent_id}:${report.lead_id}`;
    const rows = history.get(key) ?? [];
    rows.push(report); history.set(key, rows);
  }
  return unique(input.agents).map(agent => {
    const owned = leads.filter(l => leadOwner(l) === agent.id);
    const ids = new Set(owned.map(l => l.id));
    const companyDatabase = owned.filter(l => leadSourceBucket(l) === "companyDatabase").length;
    const selfAssigned = owned.filter(l => leadSourceBucket(l) === "selfAssigned").length;
    const unknownSource = owned.filter(l => leadSourceBucket(l) === "unknownSource").length;
    const otherSource = owned.filter(l => leadSourceBucket(l) === "otherSource").length;
    const conversions = new Set(unique(input.bookings).filter(b => ids.has(b.lead_id) && b.agent_id === agent.id && b.approval_status === "approved" && b.status !== "cancelled" && within(b.booked_at)).map(b => b.lead_id));
    const visits = unique(input.visits).filter(v => ids.has(v.lead_id) && v.agent_id === agent.id && v.status !== "cancelled" && within(v.created_at)).length;
    let hotLost = 0;
    for (const lead of owned) {
      if (lead.status !== "closed" || lead.outcome_category !== "not_interested" || conversions.has(lead.id)) continue;
      const chain = history.get(`${agent.id}:${lead.id}`) ?? [];
      const latest = chain.at(-1);
      if (!latest?.submitted_at || latest.category !== "not_interested" || !within(latest.submitted_at)) continue;
      const lossAt = latest.submitted_at;
      if (chain.some(r => r.temperature?.toLowerCase() === "hot" && r.submitted_at && r.submitted_at < lossAt)) hotLost++;
    }
    return { agentId: agent.id, name: agent.name, assigned: owned.length, converted: conversions.size, conversionRate: owned.length ? Math.round(conversions.size / owned.length * 1000) / 10 : null, visits, hotLost, companyDatabase, selfAssigned, unknownSource, otherSource };
  }).sort((a,b) => (b.conversionRate ?? -1) - (a.conversionRate ?? -1) || b.visits - a.visits || a.name.localeCompare(b.name));
}