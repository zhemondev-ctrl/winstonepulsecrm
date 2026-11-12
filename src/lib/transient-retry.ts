/**
 * Browser-safe recovery for polled reads while the preview/server is starting or
 * a backend read is briefly unavailable. Transient failures are retried with a
 * short back-off; access errors are never retried. When every attempt fails the
 * caller keeps its last good data instead of showing zeros or an empty list.
 */

const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const TRANSIENT_TEXT =
  /failed to fetch|fetch failed|networkerror|network error|load failed|aborted|econnreset|econnrefused|socket hang up|timed? ?out|invalid server function id|this page didn't load|<!doctype html|internal server error|bad gateway|service unavailable|gateway timeout|\bunavailable\b/i;
const ACCESS_TEXT = /sign in|signed in|access required|session expired|forbidden|not allowed|permission|only the system architect|belongs to another/i;

export function isTransientRequestError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error === "object" && "status" in error && typeof (error as { status: unknown }).status === "number") {
    return TRANSIENT_STATUS.has((error as { status: number }).status);
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return error instanceof TypeError;
  if (ACCESS_TEXT.test(message) && !/<!doctype html/i.test(message)) return false;
  return error instanceof TypeError || TRANSIENT_TEXT.test(message);
}

/** 0.75s, 1.5s, 3s … capped at 8s. */
export function transientRetryDelay(attempt: number, baseMs = 750): number {
  return Math.min(baseMs * 2 ** Math.max(0, attempt), 8_000);
}

export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientRequestError(error) || attempt === attempts - 1) throw error;
      await sleep(transientRetryDelay(attempt, opts.baseMs));
    }
  }
  throw lastError;
}

/**
 * Live board read for the public performance board. `null` from the server
 * means "results unavailable" (never zeros). With a previous good board the
 * failure is thrown so the query keeps showing that board; with none, `null`
 * shows the honest "could not be loaded" state.
 */
export async function loadLiveBoard<T>(
  fetchBoard: () => Promise<T | null>,
  previous: T | null | undefined,
  opts: { attempts?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T | null> {
  try {
    const board = await withTransientRetry(fetchBoard, opts);
    if (board) return board;
  } catch {
    /* fall through: keep the last good board or show the unavailable state */
  }
  if (previous) throw new Error("Results temporarily unavailable — showing the last loaded board");
  return null;
}
