import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { BACKUP_TABLES, RESTORABLE } from "@/lib/crm-backup.server";

describe("CRM backup coverage", () => {
  it("covers all six dual-lead baseline tables", () => {
    for (const t of ["leads", "lead_daily_assignment_ledger", "agent_lead_receipts", "audit_logs", "lead_events", "follow_up_events"])
      expect(BACKUP_TABLES).toContain(t);
  });
  it("only leads and call reports stay restorable", () => {
    expect([...RESTORABLE]).toEqual(["leads", "call_reports"]);
  });
});
