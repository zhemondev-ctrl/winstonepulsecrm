import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: { scope: "agent", userId: "user-a", profile: { id: "agent-a", name: "Agent" }, readOnly: false } as { scope: string; userId: string | null; profile: { id: string; name: string } | null; readOnly: boolean },
  lead: { id: "lead-a", name: "Synthetic lead", phone_number: "", temperature: null, assigned_to: "agent-a", assigned_agent_id: "agent-a" } as Record<string, unknown>,
  transferred: false,
  writes: [] as string[],
  filters: [] as Array<[string, unknown]>,
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/lib/access.server", () => ({
  resolveWorkCaller: async () => state.caller,
  requireWrite: (caller: typeof state.caller) => { if (caller.readOnly) throw new Error("Read only"); },
}));
vi.mock("@/lib/agent-briefing.server", () => ({ assertBriefingForCaller: vi.fn() }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => { state.writes.push("history"); } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let updating = false;
  const chain = {
    select: () => chain,
    eq: (column: string, value: unknown) => { if (updating) state.filters.push([column, value]); return chain; },
    is: (column: string, value: unknown) => { if (updating) state.filters.push([column, value]); return chain; },
    update: () => { updating = true; state.writes.push(table); return chain; },
    insert: async () => { state.writes.push(table); return { error: null }; },
    maybeSingle: async () => ({ data: updating ? (state.transferred ? null : { id: "lead-a" }) : state.lead, error: null }),
  }; return chain;
} } }));

import { triageMyLead } from "@/lib/agent-desk.functions";
const run = (action = "closed") => (triageMyLead as unknown as (arg: unknown) => Promise<unknown>)({ data: { leadId: "lead-a", action } });
beforeEach(() => {
  state.caller = { scope: "agent", userId: "user-a", profile: { id: "agent-a", name: "Agent" }, readOnly: false };
  state.lead = { id: "lead-a", name: "Synthetic lead", phone_number: "", temperature: null, assigned_to: "agent-a", assigned_agent_id: "agent-a" };
  state.transferred = false; state.writes = []; state.filters = [];
});

for (const action of ["closed", "follow_up"]) {
  for (const owners of [[null, null], ["other", "other"], ["agent-a", "other"], ["other", "agent-a"]]) {
    it(`rejects ${action} for unassigned, foreign or conflicting owners ${owners}`, async () => {
      [state.lead.assigned_to, state.lead.assigned_agent_id] = owners;
      await expect(run(action)).rejects.toThrow(); expect(state.writes).toEqual([]);
    });
  }
}
it("fails closed without a verified staff identity", async () => {
  state.caller.profile = null; await expect(run()).rejects.toThrow(); expect(state.writes).toEqual([]);
  state.caller.userId = null; await expect(run()).rejects.toThrow(); expect(state.writes).toEqual([]);
});
it("keeps HQ read-only", async () => {
  state.caller.scope = "authority"; state.caller.readOnly = true;
  await expect(run()).rejects.toThrow("Read only"); expect(state.writes).toEqual([]);
});
for (const owners of [["agent-a", "agent-a"], ["agent-a", null], [null, "agent-a"]]) {
  it(`allows canonical own work and matches both saved owner columns ${owners}`, async () => {
    [state.lead.assigned_to, state.lead.assigned_agent_id] = owners;
    await expect(run()).resolves.toMatchObject({ action: "closed" });
    expect(state.filters).toEqual([["id", "lead-a"], ["assigned_to", owners[0]], ["assigned_agent_id", owners[1]]]);
    expect(state.writes).toEqual(["leads", "history"]);
  });
}
it("does not append follow-up or history after a concurrent transfer", async () => {
  state.transferred = true; await expect(run("follow_up")).rejects.toThrow();
  expect(state.writes).toEqual(["leads"]);
});
it("preserves verified writable authority access", async () => {
  state.caller.scope = "authority"; state.caller.profile = null; state.caller.userId = null;
  state.lead.assigned_to = null; state.lead.assigned_agent_id = null;
  await expect(run()).resolves.toMatchObject({ action: "closed" });
  expect(state.filters).toEqual([["id", "lead-a"]]);
});