import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EMPTY_FORMULA, SCORE_LETTERS, SCORE_METRICS, pointsTotal, scoreFormulaSchema, type ScoreFormula, type ScoreMetric } from "@/lib/score-formula";
import { readScoreFormula, saveScoreFormula } from "@/lib/score-formula.functions";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

/** HQ: define what C, R, A, V, F count and their points out of 100. Saving does not rescore anything yet. */
export function ScoreFormulaSettings() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const read = useServerFn(readScoreFormula);
  const save = useServerFn(saveScoreFormula);
  const q = useQuery({ queryKey: ["score-formula", adminToken], queryFn: () => read({ data: { adminToken } }) });
  const [form, setForm] = useState<ScoreFormula>(EMPTY_FORMULA);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data?.formula) setForm(q.data.formula); }, [q.data]);
  const total = pointsTotal(form);
  const check = scoreFormulaSchema.safeParse(form);
  const err = check.success ? null : check.error.issues[0]?.message ?? "Invalid";
  const set = (l: (typeof SCORE_LETTERS)[number], patch: Partial<ScoreFormula["letters"]["C"]>) => setForm((f) => ({ ...f, letters: { ...f.letters, [l]: { ...f.letters[l], ...patch } } }));
  const submit = async () => {
    if (!check.success) return;
    setBusy(true);
    try { await save({ data: { adminToken, formula: check.data } }); toast.success(t({ en: "Score settings saved", bn: "স্কোর সেটিংস সংরক্ষিত" })); await qc.invalidateQueries({ queryKey: ["score-formula"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };
  const input = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <section className="card-elevated space-y-4 p-4 md:p-6">
      <header className="flex items-start gap-2">
        <Calculator className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t({ en: "Daily score formula (C, R, A, V, F)", bn: "দৈনিক স্কোর সূত্র (C, R, A, V, F)" })}</h2>
          <p className="text-sm text-muted-foreground">{t({ en: "Choose what each letter counts and its points out of 100. Saving keeps every earlier version. Each letter earns its full points when the daily target is reached, and a share below it.", bn: "প্রতিটি অক্ষর কী গণনা করবে ও ১০০-এর মধ্যে কত পয়েন্ট, বেছে নিন। আগের সব সংস্করণ রাখা হয়। দৈনিক লক্ষ্য পূরণ হলে পূর্ণ পয়েন্ট, কম হলে আনুপাতিক।" })}</p>
          {q.data?.savedAt && <p className="mt-1 text-xs text-muted-foreground">{t({ en: "Last saved", bn: "শেষ সংরক্ষণ" })}: {new Date(q.data.savedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} · {q.data.savedBy}</p>}
        </div>
      </header>
      {q.isError ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p> : (
        <>
          <div className="space-y-3">
            {SCORE_LETTERS.map((l) => (
              <div key={l} className="grid grid-cols-[2rem_1fr] gap-2 md:grid-cols-[2rem_1fr_1fr_6rem_6rem] md:items-center">
                <span className="row-span-4 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground md:row-span-1">{l}</span>
                <input aria-label={`${l} name`} className={input} placeholder={t({ en: "Name, e.g. Connected calls", bn: "নাম, যেমন সংযুক্ত কল" })} value={form.letters[l].label} onChange={(e) => set(l, { label: e.target.value })} />
                <select aria-label={`${l} counts`} className={input} value={form.letters[l].metric} onChange={(e) => set(l, { metric: e.target.value as ScoreMetric })}>
                  {(Object.keys(SCORE_METRICS) as ScoreMetric[]).map((m) => <option key={m} value={m}>{t(SCORE_METRICS[m])}</option>)}
                </select>
                <input aria-label={`${l} points`} type="number" min={0} max={100} className={input} value={form.letters[l].points} onChange={(e) => set(l, { points: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} />
                <input aria-label={`${l} daily target`} title={t({ en: "Daily count for full points", bn: "পূর্ণ পয়েন্টের দৈনিক সংখ্যা" })} type="number" min={1} max={500} placeholder={t({ en: "Target", bn: "লক্ষ্য" })} className={input} value={form.letters[l].target || ""} onChange={(e) => set(l, { target: Math.max(0, Math.min(500, Math.round(Number(e.target.value) || 0))) })} />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={form.includeSelfLeads} onChange={(e) => setForm((f) => ({ ...f, includeSelfLeads: e.target.checked }))} />
            {t({ en: "Count work on self-collected leads (max 10/day) in the score", bn: "নিজের সংগ্রহ করা লিডের কাজ (দিনে সর্বোচ্চ ১০) স্কোরে গণনা হবে" })}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm font-medium ${total === 100 ? "text-foreground" : "text-destructive"}`}>{t({ en: `Total: ${total} / 100`, bn: `মোট: ${total} / ১০০` })}{err && total === 100 ? ` · ${err}` : ""}</p>
            <Button onClick={() => void submit()} disabled={!check.success || busy}><Save />{t({ en: "Save settings", bn: "সেটিংস সংরক্ষণ" })}</Button>
          </div>
        </>
      )}
    </section>
  );
}
