/** Only verified HQ and full IT PIN scopes may decide accountability reviews. */
export function accountabilityReviewer(scope: string | null | undefined): string | null {
  if (scope === "full") return "IT Console";
  if (scope === "hq") return "Executive HQ";
  return null;
}