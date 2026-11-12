/**
 * Desk lead dashboard layout choice. Cards are the default on every screen
 * size; the table is an opt-in comparison view. The choice is a display
 * preference only — it never changes which leads are shown.
 */
export type LeadViewMode = "cards" | "table";

export const LEAD_VIEW_MODE_KEY = "winstone.desk.leadViewMode";
export const DEFAULT_LEAD_VIEW_MODE: LeadViewMode = "cards";

export function parseLeadViewMode(raw: unknown): LeadViewMode {
  return raw === "table" ? "table" : DEFAULT_LEAD_VIEW_MODE;
}

export function readLeadViewMode(): LeadViewMode {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_LEAD_VIEW_MODE;
    return parseLeadViewMode(localStorage.getItem(LEAD_VIEW_MODE_KEY));
  } catch {
    return DEFAULT_LEAD_VIEW_MODE;
  }
}

export function saveLeadViewMode(mode: LeadViewMode): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LEAD_VIEW_MODE_KEY, parseLeadViewMode(mode));
  } catch {
    // Storage blocked (private mode): the choice simply lasts for this visit.
  }
}
