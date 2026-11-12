/**
 * Site-visit edit lock (MD approval report, 11 Nov 2026, proposal 6):
 * an agent may change only a visit they entered themselves. Older rows without
 * a saved profile fall back to the saved entry name.
 */
export function agentEnteredVisit(
  visit: { agent_id: string | null; created_by: string; created_by_profile_id: string | null },
  agent: { id: string; name: string },
): boolean {
  if (visit.agent_id !== agent.id) return false;
  if (visit.created_by_profile_id) return visit.created_by_profile_id === agent.id;
  return visit.created_by === agent.name;
}
