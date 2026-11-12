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
