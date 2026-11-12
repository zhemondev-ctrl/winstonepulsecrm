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
