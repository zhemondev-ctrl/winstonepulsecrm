import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ reads: 0 }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (v: unknown) => unknown) => ({
      handler: (fn: (v: unknown) => unknown) => (args: { data: unknown }) => fn({ data: validate(args.data) }),
    }),
    handler: (fn: (v: unknown) => unknown) => fn,
  }),
}));
vi.mock("@/lib/access.server", () => ({ requireLeadHub: async (t: string | null) => { if (t !== "leadhub") throw new Error("LeadHub PIN required"); } }));
vi.mock("@/lib/lead-pool.server", () => ({ dhakaToday: () => { state.reads++; return "2026-11-12"; } }));
vi.mock("@/lib/follow-up-work.server", () => ({ followUpWork: () => null }));

import { previewDailyDistribution } from "@/lib/lead-pool.functions";
const preview = previewDailyDistribution as unknown as (a: { data: unknown }) => Promise<unknown>;

describe("dry run access", () => {
  it("refuses anyone without the LeadHub PIN before reading anything", async () => {
    await expect(preview({ data: { adminToken: "hq" } })).rejects.toThrow("LeadHub PIN required");
    expect(state.reads).toBe(0);
  });
});
