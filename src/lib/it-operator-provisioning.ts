const REQUESTED_OPERATORS = ["fmnafis11@gmail.com", "trendfluxos@gmail.com", "zhemon.dev@gmail.com"] as const;

/** Provisioning scope only; never an authentication or runtime permission check. */
export function requestedOperatorEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!(REQUESTED_OPERATORS as readonly string[]).includes(email)) throw new Error("Requested IT account required");
  return email;
}

export function requireProvisioningPin(scope: string | null) {
  if (scope !== "full") throw new Error("Full IT PIN required");
}