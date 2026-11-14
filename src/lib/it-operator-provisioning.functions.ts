import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requestedOperatorEmail, requireProvisioningPin } from "@/lib/it-operator-provisioning";

/** Explicit, PIN-authorized provisioning; no public signup, password or email send. */
export const provisionRequestedItOperator = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string(), email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    requireProvisioningPin(adminTokenScope(data.adminToken));
    const email = requestedOperatorEmail(data.email);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const profiles = await db.from("profiles").select("id,user_id,email,name,is_active,approval_status,status").ilike("email", email).limit(2);
    if (profiles.error || (profiles.data?.length ?? 0) > 1) throw new Error("Account matching unavailable");
    const existing = profiles.data?.[0];
    let userId = existing?.user_id;
    if (!userId) {
      let complete = false;
      for (let page = 1; page <= 10; page++) {
        const users = await db.auth.admin.listUsers({ page, perPage: 100 });
        if (users.error) throw new Error("Identity lookup unavailable");
        const match = users.data.users.find(user => user.email?.toLowerCase() === email);
        if (match) { userId = match.id; complete = true; break; }
        if (users.data.users.length < 100) { complete = true; break; }
      }
      if (!complete) throw new Error("Identity lookup limit reached");
      if (!userId) {
        const created = await db.auth.admin.createUser({ email, email_confirm: false });
        if (created.error || !created.data.user) throw new Error("Google identity preparation failed");
        userId = created.data.user.id;
      }
    } else {
      const user = await db.auth.admin.getUserById(userId);
      if (user.error || user.data.user?.email?.toLowerCase() !== email) throw new Error("Identity mismatch");
    }
    const roleRead = await db.from("user_roles").select("role").eq("user_id", userId);
    if (roleRead.error) throw new Error("Role snapshot unavailable");
    // Persist the prior state before any existing profile/permission change; no deletions.
    const backup = await db.from("audit_logs").insert({
      action: "account_approved", entity_type: "it_operator", entity_id: existing?.id ?? null,
      actor_label: "IT Console PIN", metadata: { email, userId, before: existing ?? null, rolesBefore: roleRead.data, operation: "requested_google_it_provisioning" },
    });
    if (backup.error) throw new Error("Account snapshot could not be saved");
    let profileId = existing?.id;
    if (existing) {
      const updated = await db.from("profiles").update({ user_id: userId, is_active: true, approval_status: "approved" }).eq("id", existing.id);
      if (updated.error) throw new Error("Account activation failed");
    } else {
      const created = await db.from("profiles").insert({ user_id: userId, email, name: email.split("@")[0] ?? email, is_active: true, approval_status: "approved" }).select("id").single();
      if (created.error) throw new Error("Operator profile preparation failed");
      profileId = created.data.id;
    }
    // The protected role table is authoritative; do not promote via editable profile data.
    const role = await db.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (role.error) throw new Error("Operator permission could not be saved");
    const verified = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").single();
    if (verified.error) throw new Error("Operator permission verification failed");
    return { ok: true, email, profileId };
  });