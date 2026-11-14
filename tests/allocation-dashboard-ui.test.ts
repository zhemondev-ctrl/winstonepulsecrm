// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/crm/NewLeadDialog", () => ({ NewLeadDialog: () => null }));
vi.mock("@/lib/i18n", () => ({ useT: () => (v: { en: string }) => v.en }));
vi.mock("@/lib/local-session", () => ({ useAdminToken: () => "fixture", useDeckToken: () => null }));
vi.mock("@/lib/session", () => ({ useMyAccount: () => ({ account: null }) }));
vi.mock("@/lib/daily-allocation.functions", () => ({ getDailyAllocation: async () => ({
  day: "2026-11-15", distributionOpen: true, quota: 50, total: 12, remaining: 38, completeCount: 0, showZeroAlert: false,
  nextHandoutAt: "2026-11-15T03:10:00.000Z", operations: null,
  agents: [{ id: "a", name: "Fixture Agent", received: 12, remaining: 38, registered: 2, selfRemaining: 8, selfLimit: 10 }],
}) }));
import { DailyAllocationSummary } from "@/components/crm/DailyAllocationSummary";
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("renders saved agent balances and a live countdown without calling assignment", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T01:21:00+06:00"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(React.createElement(QueryClientProvider, { client }, React.createElement(DailyAllocationSummary, { surface: "hq" })));
  await screen.findByLabelText("Handout countdown");
  expect(screen.getByLabelText("Handout countdown").textContent).toBe("07:49:00");
  expect(screen.getAllByText("2 / 10")).toHaveLength(2);
  expect(screen.getAllByText("38").length).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText("8")).toHaveLength(2);
  client.clear();
});