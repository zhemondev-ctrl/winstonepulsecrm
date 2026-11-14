export type SecurityEvidence = {
  id: string;
  recordedAt: string;
  scanAt: string | null;
  kind: "deep" | "basic" | "tests";
  revision: string | null;
  revisionBasis: "unknown" | "saved-code";
  state: "stale" | "pending" | "passed";
  critical: number | null;
  tests: number | null;
  summary: { en: string; bn: string };
  findings: Array<{ id: string; title: { en: string; bn: string }; state: "reported" | "resolved-in-code" }>;
};

export function canVerifyRevision(row: SecurityEvidence, revision: string): boolean {
  // A requested scan, a stale result, or passing tests cannot prove a deep scan
  // examined a particular revision. Current evidence deliberately verifies none.
  return row.kind === "deep" && row.state === "passed" && row.revision === revision && row.revisionBasis === "saved-code";
}

export function compareSecurityEvidence(before: SecurityEvidence, after: SecurityEvidence) {
  return {
    criticalDelta: before.critical === null || after.critical === null ? null : after.critical - before.critical,
    sameRevision: before.revision !== null && before.revision === after.revision,
    comparableScans: before.kind === after.kind && before.kind !== "tests" && before.state !== "pending" && after.state !== "pending",
  };
}