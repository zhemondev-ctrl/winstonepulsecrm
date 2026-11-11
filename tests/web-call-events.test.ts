// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const calls = vi.hoisted(() => ({ begin: vi.fn(), finish: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/call-reports.functions", () => ({ startMyCall: (args: unknown) => calls.begin(args), openMyReport: (args: unknown) => calls.finish(args), logAnyNumberCall: (args: unknown) => calls.finish(args) }));
vi.mock("@/lib/precall.functions", () => ({ getQuickBrief: async () => null }));
vi.mock("@/lib/local-session", () => ({ useAdminToken: () => null }));
vi.mock("@/components/crm/CallLeadContext", () => ({ CallLeadContext: () => null }));
vi.mock("@/components/crm/WebsiteAnswerBox", () => ({ WebsiteAnswerBox: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { WebCallButton } from "@/components/crm/WebCallButton";

const track = vi.fn();
let client: QueryClient;
beforeEach(() => {
  calls.begin.mockReset(); calls.finish.mockReset(); track.mockReset(); localStorage.clear();
  window.__lovableEvents = { track };
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); delete window.__lovableEvents; });
function open() { render(React.createElement(QueryClientProvider, { client }, React.createElement(WebCallButton, { phone: "synthetic-number" }))); }
it("emits a dial handoff only after successful permission, without customer fields", async () => {
  calls.begin.mockResolvedValue({ blocked: false }); open(); fireEvent.click(screen.getByRole("button", { name: "কল করুন" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("project.call_started", { source: "web_dialer", lead_linked: false }));
  expect(track).toHaveBeenCalledTimes(1);
});
it("counts blocked starts, never starts a call", async () => {
  calls.begin.mockResolvedValue({ blocked: true, reason: "private reason" }); open(); fireEvent.click(screen.getByRole("button", { name: "কল করুন" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("project.call_start_failed", { kind: "blocked" }));
  expect(track).toHaveBeenCalledTimes(1); expect(localStorage.getItem("winstone.web.call.v1")).toBeNull();
});
it("counts request failure without exposing the raw error", async () => {
  calls.begin.mockRejectedValue(new Error("private reason")); open(); fireEvent.click(screen.getByRole("button", { name: "কল করুন" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("project.call_start_failed", { kind: "request_error" }));
  expect(track).toHaveBeenCalledTimes(1);
});
it("reuses the existing end event only after saving succeeds", async () => {
  localStorage.setItem("winstone.web.call.v1", JSON.stringify({ leadId: "tel:synthetic-number", startedAt: Date.now() - 3000 }));
  calls.finish.mockResolvedValue({}); open(); fireEvent.click(await screen.findByRole("button", { name: "Call has ended · open report" }));
  await waitFor(() => expect(track).toHaveBeenCalledWith("project.call_captured", { source: "web_dialer", lead_linked: false, connected_claim: false, duration_bucket: "under_10s" }));
  expect(track).toHaveBeenCalledTimes(1);
});