// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: { scope: "none", isPending: false },
  invalidateQueries: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(),
  subscribe: vi.fn(), callbacks: [] as (() => void)[],
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => client }));
const client = { invalidateQueries: mocks.invalidateQueries };
vi.mock("@/lib/session", () => ({ useMyAccount: () => mocks.account }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  channel: mocks.channel, removeChannel: mocks.removeChannel,
} }));
import { useCrmRealtime } from "@/hooks/use-crm-realtime";

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.callbacks = [];
  mocks.account = { scope: "none", isPending: false };
  const channel = { on: (_kind: string, _filter: unknown, callback: () => void) => {
    mocks.callbacks.push(callback); return channel;
  }, subscribe: mocks.subscribe };
  mocks.channel.mockReturnValue(channel);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("shell realtime database load", () => {
  it("opens no subscription for a visitor", () => {
    renderHook(useCrmRealtime);
    expect(mocks.channel).not.toHaveBeenCalled();
  });
  it("coalesces a burst into one refresh after 8 seconds", () => {
    mocks.account.scope = "agent"; renderHook(useCrmRealtime);
    act(() => { mocks.callbacks[0]?.(); mocks.callbacks[0]?.(); vi.advanceTimersByTime(7999); });
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith(
      { queryKey: ["crm-snapshot"], refetchType: "active" }, { cancelRefetch: false },
    );
  });
  it("removes the subscription and queued reload when access is lost", () => {
    mocks.account.scope = "authority";
    const hook = renderHook(useCrmRealtime);
    act(() => mocks.callbacks[0]?.());
    mocks.account.scope = "none"; hook.rerender();
    act(() => vi.advanceTimersByTime(8000));
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });
});