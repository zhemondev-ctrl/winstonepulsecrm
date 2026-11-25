import { expect, it, vi } from "vitest";
import { runIngestDiagnostics } from "@/lib/ingest.functions";
import { PAGE_SIZE } from "@/lib/page-all";

const { ranges, requireAdminToken, leads } = vi.hoisted(() => ({
  ranges: vi.fn(),
  requireAdminToken: vi.fn(),
  leads: [] as { id: string; phone_number: string; assigned_to: string; created_at: string }[],
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/lib/admin-gate.server", () => ({ requireAdminToken }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from(table: string) {
    const query = {
      select: () => query,
      order: () => query,
      range(from: number, to: number) {
        ranges(table, from, to);
        return Promise.resolve({ data: table === "leads" ? leads.slice(from, to + 1) : [], error: null });
      },
    };
    return query;
  },
  storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
} }));

it("includes leads beyond the first page in the diagnostic totals", async () => {
  leads.length = 0;
  for (let i = 0; i <= PAGE_SIZE; i++) {
    leads.push({ id: String(i), phone_number: "invalid", assigned_to: "test-agent", created_at: "2026-01-01T00:00:00Z" });
  }
  const result = await runIngestDiagnostics({ data: { adminToken: "test-only" } });
  expect(requireAdminToken).toHaveBeenCalledWith("test-only");
  expect(ranges).toHaveBeenCalledWith("leads", PAGE_SIZE, 2 * PAGE_SIZE - 1);
  expect(result.volumes.leads).toBe(PAGE_SIZE + 1);
});
