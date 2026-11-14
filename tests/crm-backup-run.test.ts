import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ orders: [] as string[], statuses: [] as string[], corrupt: false, bytes: new Uint8Array() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => {
    const q = {
      select: () => q,
      order: (column: string) => { if (table === "lead_daily_assignment_ledger") state.orders.push(column); return q; },
      range: async () => ({ data: table === "lead_daily_assignment_ledger" ? [{ agent_id: "agent", work_date: "2026-11-15", lead_id: "lead" }] : [{ id: `${table}-1` }], error: null }),
      eq: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      upsert: async () => ({ error: null }),
      update: (row: { status: string }) => { state.statuses.push(row.status); return q; },
      lt: async () => ({ data: [], error: null }),
    };
    // history lookup needs a chainable eq; update eq is awaited directly.
    return { ...q, select: () => ({ ...q, eq: () => q }) };
  },
  storage: { from: () => ({
    upload: async (_path: string, bytes: Uint8Array) => { state.bytes = bytes; return { error: null }; },
    download: async () => ({ data: new Blob([state.corrupt ? new Uint8Array([1]) : state.bytes]), error: null }),
  }) },
} }));
import { runBackup } from "@/lib/crm-backup.server";

describe("CRM evidence backup verification", () => {
  beforeEach(() => { state.orders = []; state.statuses = []; state.corrupt = false; });
  it("reads the ledger by its full composite primary key and verifies all six baseline counts", async () => {
    const result = await runBackup("2026-11-15");
    expect(state.orders).toEqual(["agent_id", "work_date", "lead_id"]);
    expect(result.counts).toMatchObject({ leads: 1, lead_daily_assignment_ledger: 1, agent_lead_receipts: 1, audit_logs: 1, lead_events: 1, follow_up_events: 1 });
    expect(state.statuses).toContain("done");
  });
  it("never marks a corrupted stored backup complete", async () => {
    state.corrupt = true;
    await expect(runBackup("2026-11-15")).rejects.toThrow("Stored backup content mismatch");
    expect(state.statuses).not.toContain("done");
    expect(state.statuses).toContain("failed");
  });
});