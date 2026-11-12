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
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
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
/* Emulates set_development_hold_atomic: state + audit row together, or neither. */
const rpcFail = vi.hoisted(() => ({ on: false }));
async function rpc(name: string, args: Record<string, any>) {
  if (name !== "set_development_hold_atomic") return { data: null, error: { message: `unknown rpc ${name}` } };
  if (rpcFail.on) return { data: null, error: { message: "connection reset" } };
  const settings = (store.tables["system_settings"] ??= []);
  const current = settings.find((r) => r.key === "development_hold");
  if (Boolean(current?.value?.active) !== args._expect_active) return { data: { changed: false, hold: current?.value ?? {} }, error: null };
  if (current) current.value = args._hold; else settings.push({ key: "development_hold", value: args._hold });
  (store.tables["maintenance_audit"] ??= []).push({
    id: `audit-${(store.tables["maintenance_audit"] ?? []).length + 1}`,
    at: new Date().toISOString(),
    actor: args._actor, actor_role: args._actor_role, action: args._action,
    previous_state: args._previous, new_state: args._next, reason: args._reason, metadata: args._metadata,
  });
  return { data: { changed: true, hold: args._hold }, error: null };
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => builder(t), rpc } }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => undefined }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => { const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain; },
}));

const rules = await import("@/lib/development-hold");
const hold = await import("@/lib/development-hold.server");
const m = await import("@/lib/maintenance.server");
const { deviceLockResponse } = await import("../src/server");

const IT = { kind: "it_console" as const, profileId: "it-1", name: "IT Console" };
const ARCHITECT = { kind: "architect" as const, userId: "arch-1", email: "Architect@Example.com" };

beforeEach(() => {
  rpcFail.on = false;
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

    await hold.startDevelopmentHold({ who: IT });
    expect(await m.ordinaryLockMessage()).toBe(rules.DEVELOPMENT_HOLD_MESSAGE);
    const phone = await deviceLockResponse(new Request("https://x/api/public/agent/calls", { headers: { "x-device-token": "t" } }));
    expect(phone?.status).toBe(423);

    await hold.confirmDevelopmentHold({ who: ARCHITECT, note: "Update checked" });
    expect(await m.isLockedForOrdinaryUsers()).toBe(false);
    const actions = (store.tables["maintenance_audit"] ?? []).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["development_hold_started", "development_hold_confirmed"]));
    vi.useRealTimers();
  });

  it("confirming without a verified Architect session is refused", async () => {
    await hold.startDevelopmentHold({ who: IT });
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

describe("maintenance mode on/off audit log", () => {
  const holdRows = () => (store.tables["maintenance_audit"] ?? []).filter((a) => String(a.action).startsWith("development_hold"));

  it("turning on by the System Architect records the change and which Architect did it", async () => {
    await hold.startDevelopmentHold({ who: ARCHITECT });
    const [row] = holdRows();
    expect(row).toMatchObject({
      action: "development_hold_started",
      actor: "System Architect (architect@example.com)",
      actor_role: "architect",
      previous_state: "open",
      new_state: "development_hold",
    });
    expect(row?.metadata).toEqual({ surface: "architect", architect_user_id: "arch-1", architect_email: "architect@example.com" });
  });

  it("turning off records the Architect and the confirmation note", async () => {
    await hold.startDevelopmentHold({ who: IT });
    await hold.confirmDevelopmentHold({ who: ARCHITECT, note: "Update checked" });
    const off = holdRows().find((a) => a.action === "development_hold_confirmed");
    expect(off).toMatchObject({ actor_role: "architect", previous_state: "development_hold", new_state: "open", reason: "Update checked" });
    expect(off?.metadata?.architect_user_id).toBe("arch-1");
  });

  it("an IT Console start is recorded as IT Console, not as an Architect", async () => {
    await hold.startDevelopmentHold({ who: IT });
    expect(holdRows()[0]).toMatchObject({ actor: "IT Console", actor_role: "it_console", metadata: { surface: "it_console", it_profile_id: "it-1" } });
  });

  it("an already-on notice is not switched or logged twice", async () => {
    await hold.startDevelopmentHold({ who: ARCHITECT });
    hold.clearDevelopmentHoldCache();
    await hold.startDevelopmentHold({ who: IT });
    expect(holdRows()).toHaveLength(1);
  });

  it("if the audit row cannot be written the CRM is not closed", async () => {
    rpcFail.on = true;
    await expect(hold.startDevelopmentHold({ who: ARCHITECT })).rejects.toThrow(/nothing was changed/);
    hold.clearDevelopmentHoldCache();
    expect((await hold.readDevelopmentHold()).active).toBe(false);
    expect(holdRows()).toHaveLength(0);
  });

  it("history lists on/off changes newest first with the Architect's identity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T04:00:00Z"));
    await hold.startDevelopmentHold({ who: ARCHITECT });
    vi.setSystemTime(new Date("2026-11-12T05:00:00Z"));
    await hold.confirmDevelopmentHold({ who: ARCHITECT, note: "Done" });
    vi.useRealTimers();
    (store.tables["maintenance_audit"] ??= []).push({ id: "x", at: "2026-11-12T06:00:00Z", action: "payment_verified", actor: "a", actor_role: "architect", reason: null, metadata: {} });
    const history = await hold.developmentHoldHistory();
    expect(history.map((h) => h.change)).toEqual(["disabled", "enabled"]);
    expect(history[0]).toMatchObject({ role: "architect", architectEmail: "architect@example.com", note: "Done" });
  });

  it("only the System Architect can be recorded as turning it off", async () => {
    const { buildHoldAuditEntry } = await import("@/lib/development-hold-audit");
    expect(() => buildHoldAuditEntry({ change: "disable", who: IT })).toThrow(/System Architect/);
  });
});
