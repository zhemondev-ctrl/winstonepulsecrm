import { test, expect } from "vitest";
import { scoreFormulaSchema, EMPTY_FORMULA } from "@/lib/score-formula";
const f = (pts: number[], metrics?: string[]) => ({ ...EMPTY_FORMULA, letters: Object.fromEntries((["C","R","A","V","F"] as const).map((l, i) => [l, { ...EMPTY_FORMULA.letters[l], label: l, points: pts[i], ...(metrics ? { metric: metrics[i] } : {}) }])) });
test("points must total exactly 100", () => {
  expect(scoreFormulaSchema.safeParse(f([30,25,15,20,10])).success).toBe(true);
  expect(scoreFormulaSchema.safeParse(f([30,25,15,20,9])).success).toBe(false);
});
test("each letter counts a different thing", () => {
  expect(scoreFormulaSchema.safeParse(f([20,20,20,20,20], ["connected_calls","connected_calls","call_attempts","site_visits","follow_ups_on_time"])).success).toBe(false);
});
