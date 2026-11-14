/** Do not open a database subscription for a visitor with no snapshot access. */
export function shouldSubscribeToCrm(accountPending: boolean, scope: string): boolean {
  return !accountPending && scope !== "none";
}

type RefreshClient = {
  invalidateQueries: (filters: { queryKey: string[]; refetchType: "none" | "active" }, options: { cancelRefetch: boolean }) => unknown;
};
type PendingRefresh = { users: number; timer: ReturnType<typeof setTimeout> | null };
const refreshes = new WeakMap<RefreshClient, PendingRefresh>();

/** Shell and snapshot listeners share one window per query cache. */
export function acquireCrmRefresh(client: RefreshClient) {
  let pending = refreshes.get(client);
  if (!pending) {
    pending = { users: 0, timer: null };
    refreshes.set(client, pending);
  }
  const state = pending;
  state.users += 1;
  let released = false;
  return {
    invalidate() {
      if (released || state.timer) return;
      state.timer = setTimeout(() => {
        state.timer = null;
        const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        void client.invalidateQueries(
          { queryKey: ["crm-snapshot"], refetchType: hidden ? "none" : "active" },
          { cancelRefetch: false },
        );
      }, 8000);
    },
    release() {
      if (released) return;
      released = true;
      state.users -= 1;
      if (state.users === 0) {
        if (state.timer) clearTimeout(state.timer);
        refreshes.delete(client);
      }
    },
  };
}