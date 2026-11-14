// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { acquireCrmRefresh } from "@/lib/crm-live-refresh";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("coalesces shell and snapshot events even while a prior read is unresolved", () => {
  const client = { invalidateQueries: vi.fn(() => new Promise(() => {})) };
  const shell = acquireCrmRefresh(client);
  const snapshot = acquireCrmRefresh(client);
  shell.invalidate();
  vi.advanceTimersByTime(20);
  snapshot.invalidate();
  vi.advanceTimersByTime(7980);
  expect(client.invalidateQueries).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(20);
  expect(client.invalidateQueries).toHaveBeenCalledTimes(1);
  shell.release(); snapshot.release();
});

it("retains pending refresh until the last subscriber leaves", () => {
  const client = { invalidateQueries: vi.fn() };
  const first = acquireCrmRefresh(client);
  const second = acquireCrmRefresh(client);
  first.invalidate(); first.release();
  vi.advanceTimersByTime(8000);
  expect(client.invalidateQueries).toHaveBeenCalledTimes(1);
  second.invalidate(); second.release(); second.release();
  vi.advanceTimersByTime(8000);
  expect(client.invalidateQueries).toHaveBeenCalledTimes(1);
});

it("only marks hidden-tab data stale", () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const client = { invalidateQueries: vi.fn() };
  const refresh = acquireCrmRefresh(client);
  refresh.invalidate(); vi.advanceTimersByTime(8000);
  expect(client.invalidateQueries).toHaveBeenCalledWith(
    { queryKey: ["crm-snapshot"], refetchType: "none" }, { cancelRefetch: false },
  );
  refresh.release(); visibility.mockRestore();
});