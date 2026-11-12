import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ scope: null as string | null, callerScope: "authority", writes: 0, reads: 0 }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (v: unknown) => unknown) => ({
      handler: (fn: (v: unknown) => unknown) => (args: { data: unknown }) => fn({ data: validate(args.data) }),
    }),
  }),
}));
vi.mock("@/lib/admin-gate.server", () => ({ adminTokenScope: () => state.scope }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({ scope: state.callerScope }) }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const q: Record<string, unknown> = {};
      for (const k of ["select", "eq", "in", "is", "order", "limit"]) q[k] = () => { state.reads++; return q; };
      for (const k of ["insert", "update"]) q[k] = () => { state.writes++; return q; };
      q.maybeSingle = async () => ({ data: null, error: null });
      q.single = async () => ({ data: null, error: null });
      return q;
    },
  },
}));

import { canFinalize, canMarkImplemented, decisionNeedsComment, meetingApprovalPath, trackerStage, validMdDecisionDate, dhakaDecisionToday } from "@/lib/meeting-approvals";
import { createMeetingApproval, decideMeetingItem, finalizeMeetingApproval, listMeetingApprovals, listMeetingDecisions, markMeetingItemImplemented, withdrawMeetingApproval } from "@/lib/meeting-approvals.functions";

type Fn = (a: { data: unknown }) => Promise<unknown>;
const id = "00000000-0000-4000-8000-000000000001";
const create = createMeetingApproval as unknown as Fn;
const decide = decideMeetingItem as unknown as Fn;
const finalize = finalizeMeetingApproval as unknown as Fn;
const withdraw = withdrawMeetingApproval as unknown as Fn;
const list = listMeetingApprovals as unknown as Fn;
const newRequest = { adminToken: "t", title: "Sales meeting", meetingDate: "2026-11-11", summary: "Notes", items: [{ title: "Net 50 rule" }] };

describe("meeting approval rules", () => {
  it("accepts the actual MD approval date without changing the recording timestamp", () => {
    expect(validMdDecisionDate("2026-11-11", "2026-11-11", "2026-11-12")).toBe(true);
  });
  it("rejects dates before the meeting", () => {
    expect(validMdDecisionDate("2026-11-10", "2026-11-11", "2026-11-12")).toBe(false);
  });
  it("rejects future approval dates", () => {
    expect(validMdDecisionDate("2026-11-13", "2026-11-11", "2026-11-12")).toBe(false);
  });
  it("rejects invalid calendar dates", () => {
    expect(validMdDecisionDate("2026-02-30", "2026-01-01", "2026-11-12")).toBe(false);
  });
  it("uses Dhaka rather than UTC for today's date", () => {
    expect(dhakaDecisionToday(new Date("2026-11-11T19:52:00Z"))).toBe("2026-11-12");
  });
  it("only plain approval may skip a comment", () => {
    expect(decisionNeedsComment("approved")).toBe(false);
    expect(decisionNeedsComment("approved_with_changes")).toBe(true);
    expect(decisionNeedsComment("rejected")).toBe(true);
  });
  it("final submit needs every item decided", () => {
    expect(canFinalize([])).toBe(false);
    expect(canFinalize([{ decision: "approved" }, { decision: "pending" }])).toBe(false);
    expect(canFinalize([{ decision: "approved" }, { decision: "rejected" }])).toBe(true);
  });
  it("the WhatsApp link opens the HQ approvals section", () => {
    expect(meetingApprovalPath(id)).toBe(`/hq?s=approvals&approval=${id}`);
  });
});

describe("meeting approval access", () => {
  it.each(["hq", "leadhub", null])("only IT Console creates (refuses %s before writing)", async (scope) => {
    state.scope = scope; state.writes = 0;
    await expect(create({ data: newRequest })).rejects.toThrow("Only the IT Console");
    expect(state.writes).toBe(0);
  });
  it.each(["full", "leadhub", null])("only Executive HQ decides (refuses %s before writing)", async (scope) => {
    state.scope = scope; state.writes = 0;
    await expect(decide({ data: { adminToken: "t", itemId: id, decision: "approved" } })).rejects.toThrow("Only Executive HQ");
    await expect(finalize({ data: { adminToken: "t", id, signer: "MD" } })).rejects.toThrow("Only Executive HQ");
    expect(state.writes).toBe(0);
  });
  it("HQ must explain a rejection before anything is saved", async () => {
    state.scope = "hq"; state.writes = 0;
    await expect(decide({ data: { adminToken: "t", itemId: id, decision: "rejected" } })).rejects.toThrow("Add a comment");
    expect(state.writes).toBe(0);
  });
  it("HQ cannot withdraw an IT request", async () => {
    state.scope = "hq"; state.writes = 0;
    await expect(withdraw({ data: { adminToken: "t", id, reason: "not needed" } })).rejects.toThrow("Only the IT Console");
    expect(state.writes).toBe(0);
  });
  it("agents cannot read approvals", async () => {
    state.callerScope = "agent"; state.reads = 0;
    await expect(list({ data: { adminToken: null } })).rejects.toThrow("Executive HQ or IT access required");
    expect(state.reads).toBe(0);
    state.callerScope = "authority";
  });
});

describe("decision tracker: no rule change before MD's final approval", () => {
  const notStarted = "not_started" as const;
  it("a new meeting decision is awaiting MD approval", () => {
    expect(trackerStage({ decision: "pending", implementation_status: notStarted }, "awaiting")).toBe("awaiting_md");
  });
  it("an approved item stays locked until HQ submits the final decision", () => {
    expect(canMarkImplemented({ decision: "approved", implementation_status: notStarted }, "awaiting")).toBe(false);
  });
  it("approved or approved-with-changes items can be implemented after the final decision", () => {
    expect(canMarkImplemented({ decision: "approved", implementation_status: notStarted }, "decided")).toBe(true);
    expect(canMarkImplemented({ decision: "approved_with_changes", implementation_status: notStarted }, "decided")).toBe(true);
  });
  it("rejected items can never be implemented", () => {
    expect(canMarkImplemented({ decision: "rejected", implementation_status: notStarted }, "decided")).toBe(false);
  });
  it("withdrawn requests never allow implementation", () => {
    expect(canMarkImplemented({ decision: "approved", implementation_status: notStarted }, "withdrawn")).toBe(false);
  });
  it("an implemented item cannot be implemented twice", () => {
    expect(canMarkImplemented({ decision: "approved", implementation_status: "implemented" }, "decided")).toBe(false);
  });
  it.each(["hq", "leadhub", null])("only IT Console marks implemented (refuses %s before writing)", async (scope) => {
    state.scope = scope; state.writes = 0;
    await expect((markMeetingItemImplemented as unknown as Fn)({ data: { adminToken: "t", itemId: id, note: "Changed the rule" } })).rejects.toThrow("Only the IT Console");
    expect(state.writes).toBe(0);
  });
  it("agents cannot read the tracker", async () => {
    state.callerScope = "agent"; state.reads = 0;
    await expect((listMeetingDecisions as unknown as Fn)({ data: { adminToken: null } })).rejects.toThrow("Executive HQ or IT access required");
    expect(state.reads).toBe(0);
    state.callerScope = "authority";
  });
});
