import { test, expect } from "vitest";
import { buildWeeklyRecoveryPdf, weekWindow, pdfSafe } from "@/lib/recovery-weekly-pdf";
import { writeFileSync } from "fs";
test("week window is 7 days ending on to", () => { expect(weekWindow("2026-10-01", "2026-11-12")).toEqual({ from: "2026-11-06", to: "2026-11-12" }); });
test("non-latin names do not break pdf", () => { expect(pdfSafe("মেহেদী Hasan")).toBe("? Hasan"); });
test("builds", async () => {
  const b = await buildWeeklyRecoveryPdf({ from: "2026-11-06", to: "2026-11-12", generatedAt: new Date(), agentNames: { a: "Mehedi", b: "সাইফুল" },
    cells: [{ agentId: "a", kind: "conversation", day: "2026-11-08", checked: 20, short: 15 }, { agentId: "b", kind: "unreachable", day: "2026-11-10", checked: 6, short: 2 }, { agentId: "a", kind: "conversation", day: "2026-11-01", checked: 99, short: 99 }],
    rows: [{ closedAt: "2026-11-08T05:00:00Z", name: "Rahim", agentName: "Mehedi", kind: "conversation", day: "2026-11-08" }] });
  writeFileSync("/tmp/x/w.pdf", b); expect(b.length).toBeGreaterThan(1000);
});
