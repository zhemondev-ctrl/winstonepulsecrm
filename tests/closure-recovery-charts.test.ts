import { describe, expect, it } from "vitest";
import { byAgent, byDate, byKind, filterCells, missingRate, type ClosureCell } from "@/lib/closure-recovery-charts";

const cells: ClosureCell[] = [
  { agentId: "a", kind: "unreachable", day: "2026-11-01", checked: 4, short: 1 },
  { agentId: "a", kind: "conversation", day: "2026-11-02", checked: 6, short: 6 },
  { agentId: "b", kind: "conversation", day: "2026-11-02", checked: 10, short: 2 },
  { agentId: null, kind: "unreachable", day: "2026-11-03", checked: 3, short: 0 },
];

describe("closure recovery charts", () => {
  it("rate is short ÷ checked to one decimal, and empty is null not 0%", () => {
    expect(missingRate(1, 3)).toBe(33.3);
    expect(missingRate(0, 0)).toBeNull();
  });
  it("by agent: counts, verified remainder and rate per closing agent, most missing first", () => {
    expect(byAgent(cells)).toEqual([
      { key: "a", checked: 10, short: 7, verified: 3, rate: 70 },
      { key: "b", checked: 10, short: 2, verified: 8, rate: 20 },
      { key: "none", checked: 3, short: 0, verified: 3, rate: 0 },
    ]);
  });
  it("by closure type lists both types even when one is empty", () => {
    expect(byKind(filterCells(cells, "all", "conversation"))).toEqual([
      { key: "unreachable", checked: 0, short: 0, verified: 0, rate: null },
      { key: "conversation", checked: 16, short: 8, verified: 8, rate: 50 },
    ]);
  });
  it("by date keeps empty days and sums each day", () => {
    const r = byDate(cells, "2026-11-01", "2026-11-04");
    expect(r.granularity).toBe("day");
    expect(r.points.map(p => [p.key, p.checked, p.short])).toEqual([["2026-11-01", 4, 1], ["2026-11-02", 16, 8], ["2026-11-03", 3, 0], ["2026-11-04", 0, 0]]);
  });
  it("ranges over 31 days switch to weekly buckets starting on the first day", () => {
    const r = byDate(cells, "2026-10-01", "2026-11-04");
    expect(r.granularity).toBe("week");
    expect(r.points[0].key).toBe("2026-10-01");
    expect(r.points.find(p => p.key === "2026-10-29")).toMatchObject({ checked: 23, short: 9 });
    expect(r.points.reduce((n, p) => n + p.checked, 0)).toBe(23);
  });
  it("agent and type filters narrow the cells; 'none' matches the unknown agent", () => {
    expect(filterCells(cells, "none", "all")).toHaveLength(1);
    expect(filterCells(cells, "a", "unreachable")).toEqual([cells[0]]);
  });
});
