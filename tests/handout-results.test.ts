import { test, expect } from "vitest";
import { groupHandout } from "@/lib/handout-results";
test("counts unique leads per agent and lists agents who got none", () => {
  const r = groupHandout([{ id: "a", name: "A" }, { id: "b", name: "B" }], [
    { to_agent_id: "a", lead_id: "1", created_at: "2026-11-15T03:00:00Z" },
    { to_agent_id: "a", lead_id: "1", created_at: "2026-11-15T03:01:00Z" },
    { to_agent_id: "a", lead_id: "2", created_at: "2026-11-15T03:02:00Z" },
  ]);
  expect(r.rows).toEqual([{ id: "a", name: "A", received: 2, firstAt: "2026-11-15T03:00:00Z", lastAt: "2026-11-15T03:02:00Z" }, { id: "b", name: "B", received: 0, firstAt: null, lastAt: null }]);
  expect(r.total).toBe(2); expect(r.receivedCount).toBe(1);
});

import { handoutHistory } from "@/lib/handout-results";
test("history counts each lead once per day and agent", () => {
  const r = (lead: string, at: string) => ({ to_agent_id: "a", created_at: at, lead_id: lead });
  const h = handoutHistory([r("x", "2026-11-10T03:00:00Z"), r("x", "2026-11-10T04:00:00Z"), r("y", "2026-11-11T03:00:00Z")], (s) => s.slice(0, 10));
  expect(h).toEqual([{ day: "2026-11-11", counts: { a: 1 }, total: 1 }, { day: "2026-11-10", counts: { a: 1 }, total: 1 }]);
});

import { compareForecast } from "@/lib/handout-results";
test("forecast vs actual shows difference per agent, including forecast-only agents", () => {
  const r = compareForecast([{ id: "a", name: "A", received: 40 }], [{ id: "a", wouldReceive: 50 }, { id: "b", wouldReceive: 10 }], { b: "B" })!;
  expect(r).toEqual([{ id: "a", name: "A", forecast: 50, received: 40, diff: -10 }, { id: "b", name: "B", forecast: 10, received: 0, diff: -10 }]);
  expect(compareForecast([], null)).toBeNull();
});
