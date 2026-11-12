import { describe, expect, it } from "vitest";
import { planDistributionPreview } from "@/lib/distribution-preview";

const cap = { enabled: true, limit: 50 };
const agent = (id: string, o: Partial<{ quota: number; held: number; backlog: number; locked: boolean }> = {}) => ({ id, name: id, quota: 50, held: 0, backlog: 0, locked: false, ...o });

describe("distribution dry run", () => {
  it("Net-50: backlog 232 gets 0 new and is flagged", () => {
    const r = planDistributionPreview({ agents: [agent("mehedi", { backlog: 232 })], cap, pool: 1000, distributionDay: true, paused: false });
    expect(r.rows[0]).toMatchObject({ allowed: 0, wouldReceive: 0 });
    expect(r.rows[0]!.flags).toContain("net50_zero");
  });
  it("Net-50: backlog 39 gets 11 new", () => {
    const r = planDistributionPreview({ agents: [agent("monisha", { backlog: 39 })], cap, pool: 1000, distributionDay: true, paused: false });
    expect(r.rows[0]).toMatchObject({ allowed: 11, wouldReceive: 11 });
    expect(r.rows[0]!.flags).toContain("net50_reduced");
  });
  it("an HQ review lock gives 0 even with no backlog", () => {
    const r = planDistributionPreview({ agents: [agent("saiful", { locked: true })], cap, pool: 1000, distributionDay: true, paused: false });
    expect(r.rows[0]!.wouldReceive).toBe(0);
    expect(r.rows[0]!.flags).toContain("review_lock");
  });
  it("leads already received that day are subtracted", () => {
    const r = planDistributionPreview({ agents: [agent("a", { held: 30 })], cap, pool: 1000, distributionDay: true, paused: false });
    expect(r.rows[0]!.wouldReceive).toBe(20);
  });
  it("a paused day hands out nothing", () => {
    const r = planDistributionPreview({ agents: [agent("a")], cap, pool: 1000, distributionDay: true, paused: true });
    expect(r.block).toBe("paused");
    expect(r.totals.wouldAssign).toBe(0);
  });
  it("Friday hands out nothing", () => {
    const r = planDistributionPreview({ agents: [agent("a")], cap, pool: 1000, distributionDay: false, paused: false });
    expect(r.block).toBe("not_distribution_day");
    expect(r.totals.wouldAssign).toBe(0);
  });
  it("a short pool is shared round-robin and flagged", () => {
    const r = planDistributionPreview({ agents: [agent("a"), agent("b")], cap, pool: 51, distributionDay: true, paused: false });
    expect(r.rows.map((x) => x.wouldReceive)).toEqual([26, 25]);
    expect(r.totals.shortfall).toBe(49);
    expect(r.rows[1]!.flags).toContain("pool_short");
  });
  it("Net-50 switched off keeps the full quota", () => {
    const r = planDistributionPreview({ agents: [agent("a", { backlog: 232 })], cap: { enabled: false, limit: 50 }, pool: 1000, distributionDay: true, paused: false });
    expect(r.rows[0]!.wouldReceive).toBe(50);
  });
});
