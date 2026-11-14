/** Resolve a formula only from versions effective on the selected Dhaka day. */
export function scoreVersionForDay<T extends { effective_from: string; formula: string }>(day: string, versions: T[]): T | null {
  const version = versions.filter(v => v.effective_from <= day).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;
  if (version && !["policy_v2", "points100"].includes(version.formula)) throw new Error("Unsupported score version");
  return version;
}