import { beforeEach, describe, expect, it, vi } from "vitest";

/* In-memory stand-in for the privileged database client (no backend calls). */
type Row = Record<string, any>;
const store = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
function builder(table: string) {
  const rows = () => (store.tables[table] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" = "select";
  let patch: Row = {};
  const run = () => {
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (op === "update") hit.forEach((r) => Object.assign(r, patch));
    return hit;
  };
  const b: any = {
    select: () => b,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
    order: () => b,
    limit: () => b,
    update: (p: Row) => ((op = "update"), (patch = p), b),
    insert: (p: Row) => (rows().push({ ...p }), b),
    upsert: (p: Row) => {
      if (table === "system_settings") {
        const at = rows().findIndex((r) => r.key === p.key);
        if (at >= 0) rows()[at] = { ...p }; else rows().push({ ...p });
      } else if (!rows().some((r) => r.billing_period === p.billing_period)) {
        rows().push({ id: `row-${p.billing_period}`, payment_status: "verified", unlock_status: "none", unlock_expires_at: null, locked_logged_at: null, ...p });
      }
      return { ...b, then: (res: (v: unknown) => void) => res({ error: null }) };
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => { const d = run()[0]; return { data: d ?? null, error: d ? null : { message: "none" } }; },
    then: (res: (v: unknown) => void) => res({ data: run(), count: run().length, error: null }),
  };
  return b;
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => builder(t) } }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => undefined }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => { const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain; },
}));

const rules = await import("@/lib/development-hold");
const hold = await import("@/lib/development-hold.server");
const m = await import("@/lib/maintenance.server");
const { deviceLockResponse } = await import("../src/server");

beforeEach(() => {
  store.tables = {};
  hold.clearDevelopmentHoldCache();
  m.clearMaintenanceCache();
});

describe("development notice lock decision", () => {
  it("an active notice closes the CRM even when the bill is paid", () => {
    expect(rules.lockMessageFor({ holdActive: true, billingLocked: false, billingMessage: "BILL" })).toBe(rules.DEVELOPMENT_HOLD_MESSAGE);
  });
  it("an unreadable notice fails closed", () => {
    expect(rules.lockMessageFor({ holdActive: "unknown", billingLocked: false, billingMessage: "BILL" })).toBe("BILL");
  });
  it("no notice and a paid bill leaves the CRM open", () => {
    expect(rules.lockMessageFor({ holdActive: false, billingLocked: false, billingMessage: "BILL" })).toBeNull();
  });
});

describe("start and Architect confirmation", () => {
  it("starting closes staff and phones out; Architect confirmation reopens", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T03:00:00Z")); // before the 15th: bill not locked
    expect(await m.isLockedForOrdinaryUsers()).toBe(false);

    await hold.startDevelopmentHold({ actor: "IT Console", actorRole: "it_console" });
    expect(await m.ordinaryLockMessage()).toBe(rules.DEVELOPMENT_HOLD_MESSAGE);
    const phone = await deviceLockResponse(new Request("https://x/api/public/agent/calls", { headers: { "x-device-token": "t" } }));
    expect(phone?.status).toBe(423);

    await hold.confirmDevelopmentHold({ actor: "System Architect", note: "Update checked" });
    expect(await m.isLockedForOrdinaryUsers()).toBe(false);
    const actions = (store.tables["maintenance_audit"] ?? []).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["development_hold_started", "development_hold_confirmed"]));
    vi.useRealTimers();
  });

  it("confirming without a verified Architect session is refused", async () => {
    await hold.startDevelopmentHold({ actor: "IT Console", actorRole: "it_console" });
    const fns = await import("@/lib/development-hold.functions");
    const confirm = fns.architectConfirmDevelopmentHold as unknown as (a: { data: { session: string; note: string } }) => Promise<unknown>;
    await expect(confirm({ data: { session: "forged-session-token", note: "done" } })).rejects.toThrow(/Architect session/);
    hold.clearDevelopmentHoldCache();
    expect((await hold.readDevelopmentHold()).active).toBe(true);
  });

  it("IT Console has no way to end the notice", async () => {
    const fns = await import("@/lib/development-hold.functions");
    expect(Object.keys(fns).filter((k) => /confirm|release|end/i.test(k))).toEqual(["architectConfirmDevelopmentHold"]);
  });
});
