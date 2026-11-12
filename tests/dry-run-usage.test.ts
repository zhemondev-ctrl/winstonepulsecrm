import { expect, test } from "vitest";
import { tallyDryRunUsage } from "@/lib/dry-run-usage";
test("counts opens by date, weekday and status", () => {
  const r = (d: string, w: string, b: string) => ({ target_day: d, mode: "date", weekday: w, blocked: b });
  const t = tallyDryRunUsage([r("2026-11-15", "Sun", "none"), r("2026-11-15", "Sun", "none"), r("2026-11-13", "Fri", "not_distribution_day")]);
  expect(t.total).toBe(3);
  expect(t.byDate[0]).toEqual({ label: "2026-11-15", n: 2 });
  expect(t.byStatus).toEqual([{ label: "none", n: 2 }, { label: "not_distribution_day", n: 1 }]);
});

import { dryRunUsageCsv } from "@/lib/dry-run-usage";
test("CSV lists date, weekday, status rows and total", () => {
  const t = tallyDryRunUsage([
    { target_day: "2026-11-15", mode: "date", weekday: "Sun", blocked: "none" },
    { target_day: "2026-11-15", mode: "date", weekday: "Sun", blocked: "none" },
  ]);
  expect(dryRunUsageCsv(t).split("\r\n")).toEqual(["section,label,previews", "date,2026-11-15,2", "weekday,Sun,2", "status,none,2", "total,all,2", ""]);
});
