import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ reads: 0 }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (v: unknown) => unknown) => ({
      handler: (fn: (v: unknown) => unknown) => (args: { data: unknown }) => fn({ data: validate(args.data) }),
    }),
  }),
}));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async (t: string | null) => ({ scope: t === "hq" ? "authority" : "agent" }) }));
vi.mock("@/lib/closure-recovery.server", () => ({ readClosureQueue: async () => { state.reads++; return { rows: [] }; } }));

import { readClosureRecoveryQueue } from "@/lib/closure-recovery.functions";
const read = readClosureRecoveryQueue as unknown as (a: { data: unknown }) => Promise<unknown>;

describe("closure recovery access", () => {
  it("refuses agents before reading anything", async () => {
    await expect(read({ data: { adminToken: "agent", from: "2026-11-01", to: "2026-11-10" } })).rejects.toThrow("Executive HQ or IT access required");
    expect(state.reads).toBe(0);
  });
  it("lets Executive HQ / IT read", async () => {
    await read({ data: { adminToken: "hq", from: "2026-11-01", to: "2026-11-10" } });
    expect(state.reads).toBe(1);
  });
  it("refuses ranges longer than 92 days", async () => {
    await expect(async () => read({ data: { adminToken: "hq", from: "2026-01-01", to: "2026-11-10" } })).rejects.toThrow("at most 92 days");
  });
});
