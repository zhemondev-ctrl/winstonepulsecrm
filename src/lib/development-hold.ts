/**
 * Official "development in progress" hold. Browser-safe copy and the pure lock
 * decision; storage and enforcement live in development-hold.server.ts.
 * IT Console or the System Architect can start the hold; only the System
 * Architect can confirm the CRM is ready and reopen it.
 */

export const DEVELOPMENT_HOLD_TITLE = {
  bn: "অফিসিয়াল নোটিশ — ডেভেলপমেন্ট কাজ চলছে",
  en: "Official notice — development in progress",
} as const;

export const DEVELOPMENT_HOLD_BODY = {
  bn: "আজ CRM-এ development-এর কাজ চলছে, এজন্য CRM সাময়িকভাবে বন্ধ আছে। এই সমস্যার জন্য আমরা আন্তরিকভাবে দুঃখিত। System Architect নিশ্চিত করলে CRM আবার নিজে থেকেই খুলে যাবে।",
  en: "Development work is in progress on the CRM today, so the CRM is temporarily closed. We sincerely apologise for the inconvenience. It will reopen automatically once the System Architect confirms it is ready.",
} as const;

/** Server error text shown to blocked staff and phones. */
export const DEVELOPMENT_HOLD_MESSAGE =
  "DEVELOPMENT IN PROGRESS — the CRM is temporarily closed. We sincerely apologise. / development-এর কাজ চলছে, এজন্য CRM সাময়িকভাবে বন্ধ আছে। এই সমস্যার জন্য আন্তরিকভাবে দুঃখিত।";

export type DevelopmentHold = {
  active: boolean;
  startedAt: string | null;
  startedBy: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseNote: string | null;
};

export const NO_HOLD: DevelopmentHold = {
  active: false,
  startedAt: null,
  startedBy: null,
  releasedAt: null,
  releasedBy: null,
  releaseNote: null,
};

/** Read a stored value defensively; anything unrecognised is "no hold". */
export function parseDevelopmentHold(value: unknown): DevelopmentHold {
  if (!value || typeof value !== "object") return NO_HOLD;
  const v = value as Record<string, unknown>;
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : null);
  return {
    active: v["active"] === true,
    startedAt: str("startedAt"),
    startedBy: str("startedBy"),
    releasedAt: str("releasedAt"),
    releasedBy: str("releasedBy"),
    releaseNote: str("releaseNote"),
  };
}

/**
 * Which message blocks ordinary staff, or null when the CRM is open.
 * A hold wins over billing; a failed read fails closed.
 */
export function lockMessageFor(input: {
  holdActive: boolean | "unknown";
  billingLocked: boolean | "unknown";
  billingMessage: string;
}): string | null {
  if (input.holdActive === true) return DEVELOPMENT_HOLD_MESSAGE;
  if (input.holdActive === "unknown" || input.billingLocked === "unknown") return input.billingMessage;
  return input.billingLocked ? input.billingMessage : null;
}
