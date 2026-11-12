/**
 * Audit trail for the development notice ("maintenance mode"). Browser-safe:
 * builds the append-only row written together with each on/off change and maps
 * stored rows back into a history list. Only identities are recorded — never
 * passwords, PINs, session tokens or the Architect credential.
 */

export const HOLD_ENABLED_ACTION = "development_hold_started";
export const HOLD_DISABLED_ACTION = "development_hold_confirmed";
export const HOLD_AUDIT_ACTIONS = [HOLD_ENABLED_ACTION, HOLD_DISABLED_ACTION] as const;

/** Who switched the notice. The Architect is identified by the verified sign-in, never by input. */
export type HoldActor =
  | { kind: "architect"; userId: string; email: string }
  | { kind: "it_console"; profileId: string | null; name: string };

export type HoldAuditEntry = {
  actor: string;
  actorRole: "architect" | "it_console";
  action: (typeof HOLD_AUDIT_ACTIONS)[number];
  previous: "open" | "development_hold";
  next: "open" | "development_hold";
  reason: string | null;
  metadata: Record<string, string | null>;
};

export function holdActorLabel(who: HoldActor): string {
  return who.kind === "architect" ? `System Architect (${who.email.toLowerCase()})` : who.name.trim() || "IT Console";
}

export function buildHoldAuditEntry(input: { change: "enable" | "disable"; who: HoldActor; note?: string | null }): HoldAuditEntry {
  const enable = input.change === "enable";
  if (!enable && input.who.kind !== "architect") throw new Error("Only the System Architect can reopen the CRM");
  const metadata: Record<string, string | null> =
    input.who.kind === "architect"
      ? { surface: "architect", architect_user_id: input.who.userId, architect_email: input.who.email.toLowerCase() }
      : { surface: "it_console", it_profile_id: input.who.profileId };
  return {
    actor: holdActorLabel(input.who),
    actorRole: input.who.kind,
    action: enable ? HOLD_ENABLED_ACTION : HOLD_DISABLED_ACTION,
    previous: enable ? "open" : "development_hold",
    next: enable ? "development_hold" : "open",
    reason: input.note?.trim() || null,
    metadata,
  };
}

export type HoldHistoryItem = {
  id: string;
  at: string;
  change: "enabled" | "disabled";
  performedBy: string;
  role: "architect" | "it_console" | "other";
  architectEmail: string | null;
  note: string | null;
};

type AuditRow = { id: string; at: string; action: string; actor: string; actor_role: string; reason: string | null; metadata: unknown };

/** Stored audit rows → history list (newest first); unrelated rows are dropped. */
export function toHoldHistory(rows: AuditRow[]): HoldHistoryItem[] {
  return rows
    .filter((r) => (HOLD_AUDIT_ACTIONS as readonly string[]).includes(r.action))
    .map((r): HoldHistoryItem => {
      const meta = r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {};
      const email = typeof meta["architect_email"] === "string" ? (meta["architect_email"] as string) : null;
      const role: HoldHistoryItem["role"] = r.actor_role === "architect" || r.actor_role === "it_console" ? r.actor_role : "other";
      return {
        id: r.id,
        at: r.at,
        change: r.action === HOLD_ENABLED_ACTION ? ("enabled" as const) : ("disabled" as const),
        performedBy: r.actor,
        role,
        architectEmail: role === "architect" ? email : null,
        note: r.reason,
      };
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
