import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SCORE_LETTERS } from "@/lib/score-formula";

import { readDailyScores } from "@/lib/score-formula.functions";
import { dhakaDay } from "@/lib/lead-groups";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

/** HQ: read-only daily scores per agent from the policy formula 2C+2R+A+4V+1.5F. */
export function DailyScoresPanel({ selectedDay }: { selectedDay?: string } = {}) {
  const t = useT();
  const adminToken = useAdminToken();
  const today = dhakaDay(new Date().toISOString());
  const [day, setDay] = useState(today);
  const scoreDay = selectedDay ?? day;
  const read = useServerFn(readDailyScores);
  const q = useQuery({ queryKey: ["daily-scores", adminToken, scoreDay], queryFn: () => read({ data: { adminToken, day: scoreDay } }) });
  const d = q.data;
  return (
    <section className="space-y-4 py-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Trophy className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t({ en: "Daily scores", bn: "দৈনিক স্কোর" })}</h2>
            {d?.formula && <p className="text-sm text-muted-foreground">{d.version === "points100"
              ? t({ en: "V1 · Earlier target-based formula · Maximum 100 points", bn: "V1 · আগের লক্ষ্যভিত্তিক সূত্র · সর্বোচ্চ ১০০ পয়েন্ট" })
              : `V2 · 2C + 2R + A + 4V + 1.5F · ${t({ en: "Effective", bn: "কার্যকর" })} ${d.effectiveFrom}`}</p>}

          </div>
        </div>
        {!selectedDay && <input type="date" aria-label={t({ en: "Day", bn: "দিন" })} max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />}
      </header>
      {d?.formula && !q.isFetching && <dl className="grid gap-3 border-y border-border py-4 sm:grid-cols-2 lg:grid-cols-5">
        {SCORE_LETTERS.map(l => { const part = d.formula?.letters[l]; if (!part) return null; return <div key={l}>
          <dt className="font-semibold">{l} · {part.points}</dt><dd className="text-sm text-muted-foreground">{part.label}</dd>
        </div>; })}
      </dl>}
      {q.isLoading ? <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>
        : q.isError ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t({ en: "Retry", bn: "আবার চেষ্টা" })}</Button></div>
        : !d?.formula ? <p className="text-sm text-muted-foreground">{t({ en: "Save the score formula above to see daily scores.", bn: "দৈনিক স্কোর দেখতে উপরের সূত্রটি সংরক্ষণ করুন।" })}</p>
        : d.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t({ en: "No agents found.", bn: "কোনো এজেন্ট নেই।" })}</p>
        : (
          <>
            <ul className="space-y-2 md:hidden">
              {d.rows.map((r) => (
                <li key={r.agentId} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{r.name}</span><span className="text-lg font-semibold">{r.total}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.parts.map((p) => `${p.letter} ${p.count}${d.version === "points100" ? `/${p.target}` : ""} × ${p.points} → ${p.earned}`).join(" · ")}</p>
                </li>
              ))}
            </ul>
            <div className="table-scroll hidden md:block">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">{t({ en: "Agent", bn: "এজেন্ট" })}</th>
                  {d.formula && (["C", "R", "A", "V", "F"] as const).map((l) => <th key={l} className="py-2 pr-3" title={d.formula?.letters[l].label}>{l} <span className="font-normal">({d.formula?.letters[l].points})</span></th>)}
                  <th className="py-2 text-right">{t({ en: "Score", bn: "স্কোর" })}</th>
                </tr></thead>
                <tbody>{d.rows.map((r) => (
                  <tr key={r.agentId} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    {r.parts.map((p) => <td key={p.letter} className="py-2 pr-3 tabular-nums">{p.earned} <span className="text-xs text-muted-foreground">({p.count}{d.version === "points100" ? `/${p.target}` : ""} × {p.points})</span></td>)}
                    <td className="py-2 text-right text-base font-semibold tabular-nums">{r.total}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </>
        )}
    </section>
  );
}
