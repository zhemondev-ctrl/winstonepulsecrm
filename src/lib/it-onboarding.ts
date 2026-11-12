/**
 * New IT Operator onboarding (browser-safe rules). IT invites by email, the
 * operator sets their own password from the emailed link, then a signed-in IT
 * Operator with the full IT PIN approves and grants IT Console powers. Nobody
 * else ever sees or types the new operator's password.
 */

export const OFFICER_STATUSES = ["inviting", "invited", "password_set", "approved", "active", "failed"] as const;
export type OfficerStatus = (typeof OFFICER_STATUSES)[number];

export const OFFICER_STATUS_LABEL: Record<OfficerStatus, { bn: string; en: string }> = {
  inviting: { bn: "আমন্ত্রণ পাঠানো হচ্ছে", en: "Sending invite" },
  invited: { bn: "ইমেইল পাঠানো হয়েছে — পাসওয়ার্ড সেটের অপেক্ষা", en: "Invite sent — waiting for password" },
  password_set: { bn: "পাসওয়ার্ড সেট হয়েছে — অনুমোদনের অপেক্ষা", en: "Password set — waiting for approval" },
  approved: { bn: "অনুমোদিত — IT ক্ষমতা দেওয়া বাকি", en: "Approved — IT access pending" },
  active: { bn: "সক্রিয় IT অপারেটর", en: "Active IT Operator" },
  failed: { bn: "আমন্ত্রণ যায়নি — আবার চেষ্টা করুন", en: "Invite failed — try again" },
};

export function isOfficerStatus(value: unknown): value is OfficerStatus {
  return typeof value === "string" && (OFFICER_STATUSES as readonly string[]).includes(value);
}

/** Lower-cased, trimmed email or null when it is not a plausible address. */
export function normalizeOfficerEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160 ? email : null;
}

/** The approve button only works once the operator has set their own password. */
export function canApproveOfficer(status: OfficerStatus): boolean {
  return status === "password_set" || status === "approved";
}

/** A failed invite may be retried; anything further along may not be re-invited. */
export function canReinviteOfficer(status: OfficerStatus): boolean {
  return status === "failed";
}

const APP_ORIGINS = ["https://crm.winstonebd.com", "https://winstonepulsecrm.lovable.app"];

/** Where the emailed link returns to: only this app's own addresses. */
export function safeAppOrigin(raw: string): string {
  let origin: string;
  try {
    origin = new URL(raw).origin;
  } catch {
    return APP_ORIGINS[0]!;
  }
  if (APP_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/id-preview--990267f3-4198-4d83-ae21-7d9c802617f4\.lovable\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return APP_ORIGINS[0]!;
}

/**
 * Who may invite or approve a new IT Operator: the full IT PIN on this device
 * AND a signed-in, active, approved IT Operator account (an HQ viewing grant or
 * a PIN alone is not enough, because the approval is recorded against a person).
 */
export function itManagerProblem(input: {
  pinScope: string | null;
  signedInUserId: string | null;
  role: string | null;
  active: boolean;
  approved: boolean;
}): string | null {
  if (input.pinScope !== "full") return "IT Console PIN দরকার";
  if (!input.signedInUserId) return "নিজের IT Operator অ্যাকাউন্টে লগইন করুন (IT access পাতা থেকে)";
  if (input.role !== "admin" || !input.active || !input.approved) return "শুধু সক্রিয় IT Operator এটা করতে পারেন";
  return null;
}
