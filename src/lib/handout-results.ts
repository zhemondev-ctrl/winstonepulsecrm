/** Hand-out results — pure grouping of saved assignment rows, read-only. */
export type HandoutAgent = { id: string; name: string };
export type HandoutRow = { id: string; name: string; received: number; firstAt: string | null; lastAt: string | null };

export function groupHandout(agents: HandoutAgent[], assignments: { to_agent_id: string | null; created_at: string; lead_id: string }[], names: Record<string, string> = {}) {
  const m = new Map<string, { leads: Set<string>; first: string; last: string }>();
  for (const a of assignments) {
    if (!a.to_agent_id) continue;
    const v = m.get(a.to_agent_id) ?? { leads: new Set<string>(), first: a.created_at, last: a.created_at };
    v.leads.add(a.lead_id);
    if (a.created_at < v.first) v.first = a.created_at;
    if (a.created_at > v.last) v.last = a.created_at;
    m.set(a.to_agent_id, v);
  }
  const rows = new Map<string, HandoutRow>();
  for (const ag of agents) rows.set(ag.id, { id: ag.id, name: ag.name, received: 0, firstAt: null, lastAt: null });
  for (const [id, v] of m) {
    rows.set(id, { id, name: rows.get(id)?.name ?? names[id] ?? "Unknown agent", received: v.leads.size, firstAt: v.first, lastAt: v.last });
  }
  const list = [...rows.values()].sort((a, b) => b.received - a.received || a.name.localeCompare(b.name));
  return { rows: list, total: list.reduce((n, r) => n + r.received, 0), receivedCount: list.filter((r) => r.received > 0).length };
}

/** History: unique leads per Dhaka day per agent from saved assignment rows. */
export function handoutHistory(assignments: { to_agent_id: string | null; created_at: string; lead_id: string }[], dayOf: (iso: string) => string) {
  const m = new Map<string, Map<string, Set<string>>>();
  for (const a of assignments) {
    if (!a.to_agent_id) continue;
    const d = dayOf(a.created_at);
    const byAgent = m.get(d) ?? new Map<string, Set<string>>();
    const s = byAgent.get(a.to_agent_id) ?? new Set<string>();
    s.add(a.lead_id); byAgent.set(a.to_agent_id, s); m.set(d, byAgent);
  }
  return [...m].sort(([a], [b]) => b.localeCompare(a)).map(([day, byAgent]) => {
    const counts = Object.fromEntries([...byAgent].map(([id, s]) => [id, s.size]));
    return { day, counts, total: Object.values(counts).reduce((n, c) => n + c, 0) };
  });
}
