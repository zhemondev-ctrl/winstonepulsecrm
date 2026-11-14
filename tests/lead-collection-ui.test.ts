// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fx = vi.hoisted(() => ({ submit: vi.fn(), draft: vi.fn(), ready: true }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/i18n", () => ({ useT: () => (v: { en: string }) => v.en }));
vi.mock("@/lib/lead-collection.functions", () => ({ readMyLeadCollection: async () => ({ ready: fx.ready,today: "2026-11-14",used: 0,limit: 10,drafts: [],receipts: [],hasMore: false }),saveMyLeadDraft: (args: unknown) => fx.draft(args),submitMyCollectedLead: (args: unknown) => fx.submit(args) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(),error: vi.fn() } }));
import { NewLeadDialog } from "@/components/crm/NewLeadDialog";
let client: QueryClient;
beforeEach(() => { fx.ready = true; fx.submit.mockReset(); fx.draft.mockReset(); client = new QueryClient({ defaultOptions: { queries: { retry: false },mutations: { retry: false } } }); });
afterEach(() => { cleanup(); client.clear(); });
async function open() { render(React.createElement(QueryClientProvider, { client }, React.createElement(NewLeadDialog))); fireEvent.click(screen.getByRole("button",{ name: "Add lead" })); await screen.findByLabelText("Customer name"); await waitFor(() => expect((screen.getByRole("button",{ name: "Save draft" }) as HTMLButtonElement).disabled).toBe(!fx.ready)); }
function enter() { fireEvent.change(screen.getByLabelText("Customer name"),{ target: { value: "Synthetic customer" } }); fireEvent.change(screen.getByLabelText("Phone number"),{ target: { value: "০১৭১২৩৪৫৬৭৮" } }); }
describe("actual collection entry interactions with isolated writes", () => {
  it("preserves customer input after failed submission and retries with the same key", async () => {
    fx.submit.mockRejectedValue(new Error("Temporary failure")); await open(); enter(); fireEvent.click(screen.getByRole("button",{ name: "Submit",exact: true })); await screen.findByRole("alert");
    expect((screen.getByLabelText("Customer name") as HTMLInputElement).value).toBe("Synthetic customer"); const first = fx.submit.mock.calls[0]?.[0];
    fireEvent.click(screen.getByRole("button",{ name: "Submit",exact: true })); await waitFor(() => expect(fx.submit).toHaveBeenCalledTimes(2)); expect(fx.submit.mock.calls[1]?.[0]).toEqual(first);
  });
  it("a duplicate does not clear the form or claim a new receipt", async () => {
    fx.submit.mockResolvedValue({ results: [{ index: 0,status: "duplicate",receiptId: null }],used: 0,limit: 10,today: "2026-11-14" }); await open(); enter(); fireEvent.click(screen.getByRole("button",{ name: "Submit",exact: true })); await screen.findByRole("alert"); expect((screen.getByLabelText("Customer name") as HTMLInputElement).value).toBe("Synthetic customer");
  });
  it("shows a saved receipt only after accepted submission", async () => {
    fx.submit.mockResolvedValue({ results: [{ index: 0,status: "accepted",receiptId: "10000000-0000-4000-8000-000000000003" }],used: 1,limit: 10,today: "2026-11-14" }); await open(); enter(); fireEvent.click(screen.getByRole("button",{ name: "Submit",exact: true })); await screen.findByRole("button",{ name: "Add another" }); expect(screen.queryByLabelText("Customer name")).toBeNull();
    fireEvent.click(screen.getByRole("button",{ name: "Add another" })); expect((screen.getByLabelText("Customer name") as HTMLInputElement).value).toBe("");
  });
  it("inactive setup cannot save a lead or draft", async () => { fx.ready = false; await open(); enter(); expect((screen.getByRole("button",{ name: "Submit",exact: true }) as HTMLButtonElement).disabled).toBe(true); expect(fx.submit).not.toHaveBeenCalled(); expect(fx.draft).not.toHaveBeenCalled(); });
});