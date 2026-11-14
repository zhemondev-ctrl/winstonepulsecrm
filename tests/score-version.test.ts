import { describe, expect, it } from "vitest";
import { scoreVersionForDay } from "@/lib/score-version";

describe("dated scores", () => {
  const versions = [{ effective_from: "2026-11-15", formula: "policy_v2" }];
  it("keeps 14 November on the earlier formula", () => expect(scoreVersionForDay("2026-11-14", versions)).toBeNull());
  it("starts V2 on 15 November", () => expect(scoreVersionForDay("2026-11-15", versions)?.formula).toBe("policy_v2"));
  it("never applies a future version to an earlier day", () => expect(scoreVersionForDay("2026-11-16", [...versions, { effective_from: "2026-12-01", formula: "points100" }])?.formula).toBe("policy_v2"));
  it("fails closed for unknown formulas", () => expect(() => scoreVersionForDay("2026-11-15", [{ effective_from: "2026-11-15", formula: "unknown" }])).toThrow("Unsupported"));
});