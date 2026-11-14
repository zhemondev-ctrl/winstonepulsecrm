import { expect, it } from "vitest";
import { canVerifyRevision, compareSecurityEvidence } from "@/lib/security-history";
import { securityHistory } from "@/lib/security-history.server";

it("does not treat pending, stale or regression evidence as deep verification", () => {
  for (const row of securityHistory) expect(canVerifyRevision(row, "e41e0544")).toBe(false);
});
it("preserves the original two findings and does not link them to an unknown code revision", () => {
  const row = securityHistory.find(r => r.id === "deep-20261114-145704");
  expect(row?.critical).toBe(2); expect(row?.revision).toBeNull(); expect(row?.state).toBe("stale");
});
it("does not turn the two fixed findings into a zero-count deep result", () => {
  const before = securityHistory[0]; const after = securityHistory[3];
  if (!before || !after) throw new Error("Missing evidence");
  expect(compareSecurityEvidence(before, after)).toMatchObject({ criticalDelta: null, comparableScans: false });
});
it("retains 51 passing tests independently of scanner results", () => {
  expect(securityHistory.find(r => r.kind === "tests")).toMatchObject({ revision: "e41e0544", tests: 51, critical: null });
});