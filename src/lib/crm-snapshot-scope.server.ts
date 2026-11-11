export async function resolveSnapshotCaller(token: string | null | undefined, view?: "default" | "agent") {
  const { resolveCaller, resolveWorkCaller } = await import("@/lib/access.server");
  if (view === "agent") {
    const session = await resolveWorkCaller(null);
    if (session.profile) return session;
    return resolveWorkCaller(token);
  }
  return resolveCaller(token);
}

