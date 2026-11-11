/** Pure summary for the read-only "Agent own leads" view (IT Console + HQ).
 * Company leads (50 per Dhaka day) stay mandatory; own leads are extra credit,
 * and only qualified (Hot/Warm) own leads count as success. */
export type SelfLeadRow = { id: string; name: string | null; phone: string | null; agentId: string; status: string | null; createdAt: string; lastOutcome: string | null; temperature: string | null; followUps: number };
export type AgentSelfSummary = { agentId: string; name: string; ownAdded: number; ownQualified: number; companyToday: number; companyDoneToday: number; companyComplete: boolean };

export const COMPANY_DAILY_TASK = 50;
export const isQualified = (t: string | null) => ["hot", "warm"].includes((t ?? "").toLowerCase());

export function summarizeAgents(
  rows: SelfLeadRow[],
  company: { agentId: string; total: number; done: number }[],
  names: Map<string, string>,
): AgentSelfSummary[] {
  const map = new Map<string, AgentSelfSummary>();
  const get = (id: string) => {
    let s = map.get(id);
    if (!s) { s = { agentId: id, name: names.get(id) ?? "—", ownAdded: 0, ownQualified: 0, companyToday: 0, companyDoneToday: 0, companyComplete: false }; map.set(id, s); }
    return s;
  };
  for (const r of rows) { const s = get(r.agentId); s.ownAdded++; if (isQualified(r.temperature)) s.ownQualified++; }
  for (const c of company) { const s = get(c.agentId); s.companyToday = c.total; s.companyDoneToday = c.done; }
  for (const s of map.values()) s.companyComplete = s.companyToday > 0 && s.companyDoneToday >= s.companyToday;
  return [...map.values()].sort((a, b) => b.ownQualified - a.ownQualified || b.ownAdded - a.ownAdded || a.name.localeCompare(b.name));
}

export function maskPhone(p: string | null): string {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  return d.length < 6 ? "••••" : `${d.slice(0, 3)}••••${d.slice(-3)}`;
}
