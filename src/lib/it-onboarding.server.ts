import {
  canApproveOfficer,
  canReinviteOfficer,
  isOfficerStatus,
  itManagerProblem,
  normalizeOfficerEmail,
  safeAppOrigin,
  type OfficerStatus,
} from "@/lib/it-onboarding";

/**
 * New IT Operator onboarding. Uses the server-only it_officer_onboarding table
 * and the advance_it_officer_onboarding DB function, whose trigger re-checks the
 * verified email, the step order and that the approver is an active IT Operator.
 * Passwords never pass through this module: the operator sets their own from
 * the emailed link.
 */

export type OfficerInvite = {
  id: string;
  name: string;
  email: string;
  status: OfficerStatus;
  invitedAt: string;
  passwordSetAt: string | null;
  approvedAt: string | null;
  activeAt: string | null;
};

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Full IT PIN + signed-in active IT Operator; returns the operator's identity. */
export async function requireItManager(adminToken: string | null | undefined) {
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  const { resolveCaller } = await import("@/lib/access.server");
  const pinScope = adminTokenScope(adminToken ?? null);
  const session = await resolveCaller(null, { skipMaintenance: true });
  const problem = itManagerProblem({
    pinScope,
    signedInUserId: session.userId,
    role: session.profile?.role ?? null,
    active: Boolean(session.profile?.is_active),
    approved: session.approval === "approved",
  });
  if (problem) throw new Error(problem);
  return { userId: session.userId!, profileId: session.profile!.id, name: session.profile!.name ?? "IT Operator" };
}

/** IT Console list (full IT PIN). Includes whether this browser may approve. */
export async function listOfficerInvites(adminToken: string | null | undefined) {
  const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null, { skipMaintenance: true });
  requireAuthority(caller);
  requireWrite(caller);
  const client = await admin();
  const { data, error } = await client
    .from("it_officer_onboarding")
    .select("id, name, email, status, invited_at, password_set_at, approved_at, role_assigned_at")
    .order("invited_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("IT অপারেটরের তালিকা আনা যায়নি");
  let canManage = true;
  let manageProblem: string | null = null;
  try {
    await requireItManager(adminToken);
  } catch (e) {
    canManage = false;
    manageProblem = e instanceof Error ? e.message : "অনুমতি নেই";
  }
  const invites: OfficerInvite[] = (data ?? [])
    .filter((r) => isOfficerStatus(r.status))
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      status: r.status as OfficerStatus,
      invitedAt: r.invited_at,
      passwordSetAt: r.password_set_at,
      approvedAt: r.approved_at,
      activeAt: r.role_assigned_at,
    }));
  return { invites, canManage, manageProblem };
}

/** Sends the set-your-password email and creates a pending, inactive profile. */
export async function inviteOfficer(input: { adminToken?: string | null | undefined; name: string; email: string; origin: string }) {
  const manager = await requireItManager(input.adminToken);
  const email = normalizeOfficerEmail(input.email);
  const name = input.name.trim();
  if (!email) throw new Error("সঠিক ইমেইল দিন");
  if (name.length < 2 || name.length > 80) throw new Error("নাম ২–৮০ অক্ষরের মধ্যে দিন");
  const client = await admin();

  const { data: protectedRow } = await client.from("privileged_account_allowlist").select("email").eq("email", email).maybeSingle();
  if (protectedRow) throw new Error("এই ইমেইলটি সুরক্ষিত অ্যাকাউন্টের — নতুন অপারেটর হিসেবে যোগ করা যাবে না");
  const { data: existingProfile } = await client.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existingProfile) throw new Error("এই ইমেইলে আগেই CRM অ্যাকাউন্ট আছে");

  const { data: prior } = await client.from("it_officer_onboarding").select("id, status").eq("email", email).maybeSingle();
  let rowId: string;
  if (prior) {
    if (!isOfficerStatus(prior.status) || !canReinviteOfficer(prior.status)) throw new Error("এই ইমেইলে আগেই আমন্ত্রণ আছে");
    const { error } = await client.from("it_officer_onboarding")
      .update({ name, status: "inviting", invited_by: manager.userId, invited_at: new Date().toISOString(), user_id: null, profile_id: null })
      .eq("id", prior.id).eq("status", "failed");
    if (error) throw new Error("আমন্ত্রণ শুরু করা যায়নি");
    rowId = prior.id;
  } else {
    const { data: row, error } = await client.from("it_officer_onboarding")
      .insert({ email, name, invited_by: manager.userId, status: "inviting" })
      .select("id").single();
    if (error || !row) throw new Error("আমন্ত্রণ শুরু করা যায়নি");
    rowId = row.id;
  }

  const fail = async () => {
    await client.from("it_officer_onboarding").update({ status: "failed" }).eq("id", rowId);
  };

  const redirectTo = `${safeAppOrigin(input.origin)}/it-setup`;
  const invited = await client.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name } });
  const userId = invited.data?.user?.id;
  if (invited.error || !userId) {
    await fail();
    console.error("IT officer invite failed", invited.error?.message ?? "no user");
    throw new Error("আমন্ত্রণ ইমেইল পাঠানো যায়নি — ইমেইলটি অন্য অ্যাকাউন্টে আছে কিনা দেখুন");
  }

  const { data: profile, error: profileError } = await client.from("profiles")
    .insert({ user_id: userId, name, email, role: "agent", requested_role: "agent", approval_status: "pending", is_active: false })
    .select("id").single();
  if (profileError || !profile) {
    await client.auth.admin.deleteUser(userId);
    await fail();
    throw new Error("প্রোফাইল তৈরি হয়নি — কিছুই বদলানো হয়নি");
  }

  const { error: linkError } = await client.from("it_officer_onboarding")
    .update({ user_id: userId, profile_id: profile.id, status: "invited" })
    .eq("id", rowId);
  if (linkError) throw new Error("আমন্ত্রণ সংরক্ষণ হয়নি");

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "it_officer_invited",
    entityType: "profile",
    entityId: profile.id,
    actorProfileId: manager.profileId,
    actorLabel: manager.name,
    metadata: { onboardingId: rowId },
  });
  return { ok: true as const };
}

/** The invited operator's own status (signed in from the emailed link). */
export async function ownOfficerSetup(userId: string) {
  const client = await admin();
  const { data } = await client.from("it_officer_onboarding").select("id, name, status").eq("user_id", userId).maybeSingle();
  if (!data || !isOfficerStatus(data.status)) return null;
  return { name: data.name, status: data.status };
}

/** Called after the operator saved their own password. */
export async function markOwnPasswordSet(userId: string) {
  const client = await admin();
  const { data } = await client.from("it_officer_onboarding").select("id, status").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("এই অ্যাকাউন্টের জন্য কোনো IT আমন্ত্রণ নেই");
  if (data.status === "invited") {
    const { error } = await client.rpc("advance_it_officer_onboarding", { _id: data.id, _action: "password_set", _actor: userId });
    if (error) {
      console.error("IT officer password step failed", error.message);
      throw new Error("পাসওয়ার্ড ধাপ সংরক্ষণ হয়নি — আবার চেষ্টা করুন");
    }
  }
  return ownOfficerSetup(userId);
}

/** Approve + grant IT Operator powers in one go (two audited DB steps). */
export async function approveOfficer(input: { adminToken?: string | null | undefined; id: string }) {
  const manager = await requireItManager(input.adminToken);
  const client = await admin();
  const { data } = await client.from("it_officer_onboarding").select("id, status, user_id").eq("id", input.id).maybeSingle();
  if (!data || !isOfficerStatus(data.status)) throw new Error("আমন্ত্রণ পাওয়া যায়নি");
  if (data.user_id === manager.userId) throw new Error("নিজেকে অনুমোদন করা যায় না");
  if (!canApproveOfficer(data.status)) throw new Error("অপারেটর এখনো নিজের পাসওয়ার্ড সেট করেননি");
  if (data.status === "password_set") {
    const { error } = await client.rpc("advance_it_officer_onboarding", { _id: data.id, _action: "approve", _actor: manager.userId });
    if (error) throw new Error("অনুমোদন সংরক্ষণ হয়নি");
  }
  const { error } = await client.rpc("advance_it_officer_onboarding", { _id: data.id, _action: "assign_role", _actor: manager.userId });
  if (error) throw new Error("IT ক্ষমতা দেওয়া যায়নি — অনুমোদন সংরক্ষিত আছে, আবার চাপুন");
  return { ok: true as const };
}

/** Profiles that belong to an IT Operator invite (kept out of agent approvals). */
export async function officerProfileIds(): Promise<Set<string>> {
  const client = await admin();
  const { data, error } = await client.from("it_officer_onboarding").select("profile_id").not("profile_id", "is", null);
  if (error) throw new Error("IT আমন্ত্রণ যাচাই করা যায়নি");
  return new Set((data ?? []).map((r) => r.profile_id as string));
}
