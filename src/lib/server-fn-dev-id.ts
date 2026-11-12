/**
 * Preview (dev server) only. After a restart, an already-open tab keeps calling
 * server functions whose source file the fresh dev server has not compiled yet.
 * TanStack Start only knows a server-function ID once that file was compiled for
 * the browser, so those calls failed with "Invalid server function ID" (HTTP 500).
 *
 * This decodes the source file named inside a `/_serverFn/<id>` URL so the dev
 * server can compile it first. Only `src/**.functions.ts(x)` paths are accepted;
 * anything else (other paths, traversal, malformed IDs) returns null and the
 * request continues untouched. Never used by the published build.
 */
const SERVER_FN_PREFIX = "/_serverFn/";
const SAFE_SOURCE = /^\/src\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.functions\.tsx?$/;

export function serverFnSourceFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const path = url.split("?")[0] ?? "";
  if (!path.startsWith(SERVER_FN_PREFIX)) return null;
  const id = path.slice(SERVER_FN_PREFIX.length).split("/")[0] ?? "";
  if (!id || id.length > 2048 || !/^[A-Za-z0-9_-]+={0,2}$/.test(id)) return null;
  let decoded: unknown;
  try {
    const b64 = id.replace(/-/g, "+").replace(/_/g, "/");
    decoded = JSON.parse(atob(b64 + "===".slice((b64.length + 3) % 4)));
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object") return null;
  const file = (decoded as Record<string, unknown>)["file"];
  if (typeof file !== "string") return null;
  const source = file.split("?")[0] ?? "";
  if (source.includes("..") || !SAFE_SOURCE.test(source)) return null;
  return source;
}
