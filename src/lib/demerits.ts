/**
 * Demerit log — pure rules. MD approval report, 11 Nov 2026, proposal 5:
 * every system block (accountability review) is one permanent demerit point
 * for the annual evaluation; Executive HQ may cancel a point with a reason.
 */
export type DemeritEntry = { reviewId: string; agentId: string; businessDate: string; pendingPercent: number; status: string; cancelled: { reason: string; at: string } | null };

export function demeritTotals(entries: DemeritEntry[]) {
  const by = new Map<string, { points: number; cancelled: number }>();
  for (const e of entries) {
    const t = by.get(e.agentId) ?? { points: 0, cancelled: 0 };
    if (e.cancelled) t.cancelled += 1;
    else t.points += 1;
    by.set(e.agentId, t);
  }
  return by;
}

export function yearBounds(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}
