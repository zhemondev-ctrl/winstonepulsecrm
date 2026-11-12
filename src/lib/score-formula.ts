/**
 * Daily score formula settings (C, R, A, V, F) — pure validation, no I/O.
 * Each letter maps to one measurable metric from a fixed list and a point value;
 * points must total exactly 100. Each letter earns points × min(1, count ÷ target); see daily-score.ts.
 */
import { z } from "zod";

export const SCORE_LETTERS = ["C", "R", "A", "V", "F"] as const;
export type ScoreLetter = (typeof SCORE_LETTERS)[number];

export const SCORE_METRICS = {
  connected_calls: { en: "Phone-proven connected calls", bn: "ফোনে প্রমাণিত সংযুক্ত কল" },
  reports_submitted: { en: "Call reports submitted", bn: "জমা দেওয়া কল রিপোর্ট" },
  call_attempts: { en: "Phone-recorded call attempts", bn: "ফোনে রেকর্ড হওয়া কল চেষ্টা" },
  site_visits: { en: "Saved site visits", bn: "সংরক্ষিত সাইট ভিজিট" },
  follow_ups_on_time: { en: "Follow-ups done on time", bn: "সময়মতো ফলো-আপ" },
  company_leads_worked: { en: "Company leads worked (of 50)", bn: "কাজ করা কোম্পানি লিড (৫০-এর মধ্যে)" },
  bookings_approved: { en: "Approved bookings", bn: "অনুমোদিত বুকিং" },
} as const;
export type ScoreMetric = keyof typeof SCORE_METRICS;

const metricKeys = Object.keys(SCORE_METRICS) as [ScoreMetric, ...ScoreMetric[]];

const letter = (l: string) => z.object({
  label: z.string().trim().min(1, `${l}: name required`).max(60),
  metric: z.enum(metricKeys),
  points: z.number().int().min(0).max(100),
  /** Daily count that earns the full points; fewer earns a share. */
  target: z.number().int().min(1, `${l}: daily target required`).max(500),
});

export const scoreFormulaSchema = z.object({
  letters: z.object({ C: letter("C"), R: letter("R"), A: letter("A"), V: letter("V"), F: letter("F") }),
  includeSelfLeads: z.boolean(),
}).superRefine((v, ctx) => {
  const total = SCORE_LETTERS.reduce((n, l) => n + v.letters[l].points, 0);
  if (total !== 100) ctx.addIssue({ code: "custom", message: `Points must total 100 (now ${total})` });
  const used = SCORE_LETTERS.map((l) => v.letters[l].metric);
  if (new Set(used).size !== used.length) ctx.addIssue({ code: "custom", message: "Each letter must count a different thing" });
});
export type ScoreFormula = z.infer<typeof scoreFormulaSchema>;

export const pointsTotal = (f: Pick<ScoreFormula, "letters">) => SCORE_LETTERS.reduce((n, l) => n + (Number(f.letters[l]?.points) || 0), 0);

export const EMPTY_FORMULA: ScoreFormula = {
  letters: {
    C: { label: "", metric: "connected_calls", points: 0, target: 0 },
    R: { label: "", metric: "reports_submitted", points: 0, target: 0 },
    A: { label: "", metric: "call_attempts", points: 0, target: 0 },
    V: { label: "", metric: "site_visits", points: 0, target: 0 },
    F: { label: "", metric: "follow_ups_on_time", points: 0, target: 0 },
  },
  includeSelfLeads: false,
};
