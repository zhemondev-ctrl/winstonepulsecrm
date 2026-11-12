/**
 * Chart math for the closure recovery review — pure, no I/O, read-only.
 * Input is one cell per (closing agent, closure type, Dhaka day) with how many
 * closures were checked and how many were short of verified calls. The rule for
 * "short" lives in closure-attempts.ts; nothing here changes it.
 */
import type { ClosureKind } from "./closure-attempts";

export type ClosureCell = { agentId: string | null; kind: ClosureKind; day: string; checked: number; short: number };
export type RateBar = { key: string; checked: number; short: number; verified: number; rate: number | null };

/** Share of checked closures that were short of verified calls, one decimal; null when nothing was checked. */
export function missingRate(short: number, checked: number): number | null {
  if (checked <= 0) return null;
  return Math.round((short / checked) * 1000) / 10;
}

function bar(key: string, checked: number, short: number): RateBar {
  return { key, checked, short, verified: checked - short, rate: missingRate(short, checked) };
}

function group(cells: ClosureCell[], keyOf: (c: ClosureCell) => string) {
  const m = new Map<string, { checked: number; short: number }>();
  for (const c of cells) {
    const k = keyOf(c);
    const v = m.get(k) ?? { checked: 0, short: 0 };
    v.checked += c.checked;
    v.short += c.short;
    m.set(k, v);
  }
  return m;
}

export function filterCells(cells: ClosureCell[], agent: string, kind: "all" | ClosureKind) {
  return cells.filter(c => (agent === "all" || (c.agentId ?? "none") === agent) && (kind === "all" || c.kind === kind));
}

/** Per closing agent, most missing first (ties: most checked, then key). */
export function byAgent(cells: ClosureCell[]): RateBar[] {
  return [...group(cells, c => c.agentId ?? "none")].map(([k, v]) => bar(k, v.checked, v.short))
    .sort((a, b) => b.short - a.short || b.checked - a.checked || a.key.localeCompare(b.key));
}

/** Both closure types always listed, even when one had no closures. */
export function byKind(cells: ClosureCell[]): RateBar[] {
  const g = group(cells, c => c.kind);
  return (["unreachable", "conversation"] as ClosureKind[]).map(k => bar(k, g.get(k)?.checked ?? 0, g.get(k)?.short ?? 0));
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Every Dhaka day in range (weekly buckets from `from` when longer than 31 days), empty periods kept. */
export function byDate(cells: ClosureCell[], from: string, to: string): { granularity: "day" | "week"; points: RateBar[] } {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5) + 1;
  const granularity = days > 31 ? "week" : "day";
  const step = granularity === "week" ? 7 : 1;
  const start = Date.parse(`${from}T00:00:00Z`);
  const g = group(cells.filter(c => c.day >= from && c.day <= to), c => addDays(from, Math.floor((Date.parse(`${c.day}T00:00:00Z`) - start) / 864e5 / step) * step));
  const points: RateBar[] = [];
  for (let d = from; d <= to; d = addDays(d, step)) points.push(bar(d, g.get(d)?.checked ?? 0, g.get(d)?.short ?? 0));
  return { granularity, points };
}
