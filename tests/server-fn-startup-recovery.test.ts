import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: after a preview restart the open tab's top-performer and
 * support-inbox polls returned HTTP 500 ("Invalid server function ID" before the
 * fresh dev server had compiled their files) or failed while data was
 * unavailable. These checks cover the dev-server ID decoding, both server
 * functions' typed "unavailable" results, and the client retry/keep-last-good rules.
 */

const state = vi.hoisted(() => ({
  board: null as unknown,
  boardError: null as Error | null,
  caller: { scope: "authority", profile: { id: "p1", name: "IT" }, readOnly: false } as unknown,
  callerError: null as Error | null,
  access: { inbox: true },
  tickets: [{ id: "t1" }] as unknown[],
  ticketsError: null as Error | null,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/lib/top-performer.server", () => ({
  dailyTopPerformer: async () => {
    if (state.boardError) throw state.boardError;
    return state.board;
  },
}));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => {
    if (state.callerError) throw state.callerError;
    return state.caller;
  },
}));
vi.mock("@/lib/team-support-access.server", () => ({ supportAccess: async () => state.access }));
vi.mock("@/lib/team-support.server", () => ({
  listInboxTickets: async () => {
    if (state.ticketsError) throw state.ticketsError;
    return state.tickets;
  },
  listReplies: async () => [],
}));

const { serverFnSourceFromUrl } = await import("@/lib/server-fn-dev-id");
const { isTransientRequestError, loadLiveBoard, withTransientRetry } = await import("@/lib/transient-retry");
const topFns = await import("@/lib/top-performer.functions");
const supportFns = await import("@/lib/team-support.functions");
const topPerformerToday = topFns.topPerformerToday as unknown as () => Promise<unknown>;
const supportInbox = supportFns.supportInbox as unknown as (a: { data: { adminToken: string | null } }) => Promise<{ allowed: boolean; tickets: unknown[]; error: string | null }>;

const quietLog = () => vi.spyOn(console, "error").mockImplementation(() => {});
const noSleep = async () => {};

// The exact IDs the preview tab sent when the two requests failed.
const TOP_ID = "eyJmaWxlIjoiL3NyYy9saWIvdG9wLXBlcmZvcm1lci5mdW5jdGlvbnMudHM_dHNzLXNlcnZlcmZuLXNwbGl0IiwiZXhwb3J0IjoidG9wUGVyZm9ybWVyVG9kYXlfY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9";
const INBOX_ID = "eyJmaWxlIjoiL3NyYy9saWIvdGVhbS1zdXBwb3J0LmZ1bmN0aW9ucy50cz90c3Mtc2VydmVyZm4tc3BsaXQiLCJleHBvcnQiOiJzdXBwb3J0SW5ib3hfY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9";
const idFor = (file: string) => btoa(JSON.stringify({ file, export: "x_createServerFn_handler" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

beforeEach(() => {
  state.board = { dateKey: "2026-11-12", revealed: true, topThree: [], otherAgents: [] };
  state.boardError = null;
  state.callerError = null;
  state.access = { inbox: true };
  state.tickets = [{ id: "t1" }];
  state.ticketsError = null;
});

describe("preview restart: the dev server can find both server functions' files", () => {
  it("decodes the top-performer request to its source file", () => {
    expect(serverFnSourceFromUrl(`/_serverFn/${TOP_ID}`)).toBe("/src/lib/top-performer.functions.ts");
  });
  it("decodes the support-inbox request (with its payload) to its source file", () => {
    expect(serverFnSourceFromUrl(`/_serverFn/${INBOX_ID}?payload=%7B%7D`)).toBe("/src/lib/team-support.functions.ts");
  });
  it("refuses anything that is not a src/**.functions.ts file", () => {
    expect(serverFnSourceFromUrl(`/_serverFn/${idFor("/src/lib/../../etc/passwd.functions.ts")}`)).toBeNull();
    expect(serverFnSourceFromUrl(`/_serverFn/${idFor("/src/lib/maintenance.server.ts")}`)).toBeNull();
    expect(serverFnSourceFromUrl(`/_serverFn/${idFor("/node_modules/x/a.functions.ts")}`)).toBeNull();
    expect(serverFnSourceFromUrl("/_serverFn/not-base64!!")).toBeNull();
    expect(serverFnSourceFromUrl("/desk")).toBeNull();
  });
});

describe("topPerformerToday when required data is unavailable", () => {
  it("returns the board when the read works", async () => {
    expect(await topPerformerToday()).toMatchObject({ dateKey: "2026-11-12" });
  });
  it("returns null (unavailable), not a 500, when the backend read fails", async () => {
    const log = quietLog();
    state.boardError = new Error("connection terminated");
    await expect(topPerformerToday()).resolves.toBeNull();
    log.mockRestore();
  });
});

describe("supportInbox when the server is restarting or data is unavailable", () => {
  it("returns tickets for an allowed caller", async () => {
    await expect(supportInbox({ data: { adminToken: null } })).resolves.toMatchObject({ allowed: true, tickets: [{ id: "t1" }], error: null });
  });
  it("returns typed unavailable when the caller cannot be resolved", async () => {
    const log = quietLog();
    state.callerError = new Error("fetch failed");
    await expect(supportInbox({ data: { adminToken: null } })).resolves.toEqual({ allowed: false, tickets: [], replies: [], error: "unavailable" });
    log.mockRestore();
  });
  it("returns typed unavailable when the ticket read fails", async () => {
    const log = quietLog();
    state.ticketsError = new Error("canceling statement due to statement timeout");
    await expect(supportInbox({ data: { adminToken: null } })).resolves.toMatchObject({ allowed: false, tickets: [], error: "unavailable" });
    log.mockRestore();
  });
  it("a caller without inbox access gets no tickets and no error", async () => {
    state.access = { inbox: false };
    await expect(supportInbox({ data: { adminToken: null } })).resolves.toEqual({ allowed: false, tickets: [], replies: [], error: null });
  });
});

describe("client recovery rules", () => {
  it("treats restart failures as temporary", () => {
    expect(isTransientRequestError(new Error(`Invalid server function ID: ${TOP_ID}`))).toBe(true);
    expect(isTransientRequestError(new Error("<!doctype html><title>This page didn't load</title>"))).toBe(true);
    expect(isTransientRequestError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransientRequestError(new Error("unavailable"))).toBe(true);
    expect(isTransientRequestError({ status: 503 })).toBe(true);
  });
  it("never retries access refusals", () => {
    expect(isTransientRequestError(new Error("IT Console access required"))).toBe(false);
    expect(isTransientRequestError(new Error("Architect session expired — sign in again"))).toBe(false);
    expect(isTransientRequestError({ status: 403 })).toBe(false);
  });
  it("retries a restarting server and returns the board once it answers", async () => {
    let calls = 0;
    const board = await loadLiveBoard(async () => {
      calls++;
      if (calls < 3) throw new Error("Invalid server function ID: x");
      return { dateKey: "2026-11-12" };
    }, undefined, { sleep: noSleep });
    expect(calls).toBe(3);
    expect(board).toEqual({ dateKey: "2026-11-12" });
  });
  it("keeps the last good board when every retry fails", async () => {
    await expect(loadLiveBoard(async () => { throw new Error("Bad Gateway"); }, { dateKey: "old" }, { sleep: noSleep })).rejects.toThrow(/last loaded board/);
  });
  it("keeps the last good board when the server reports results unavailable", async () => {
    await expect(loadLiveBoard(async () => null, { dateKey: "old" }, { sleep: noSleep })).rejects.toThrow(/last loaded board/);
  });
  it("shows the unavailable state (null), never zeros, with no earlier board", async () => {
    await expect(loadLiveBoard(async () => null, undefined, { sleep: noSleep })).resolves.toBeNull();
  });
  it("does not retry an access refusal", async () => {
    let calls = 0;
    await expect(withTransientRetry(async () => { calls++; throw new Error("IT Console access required"); }, { sleep: noSleep })).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
