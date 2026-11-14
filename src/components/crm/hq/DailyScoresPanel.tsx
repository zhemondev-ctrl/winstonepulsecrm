import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { useState } from "react";

import { readDailyScores } from "@/lib/score-formula.functions";
import { dhakaDay } from "@/lib/lead-groups";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

/** HQ: read-only daily scores per agent from the policy formula 2C+2R+A+4V+1.5F. */
export function DailyScoresPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const today = dhakaDay(new Date().toISOString());
  const [day, setDay] = useState(today);
  const read = useServerFn(readDailyScores);
  const q = useQuery({ queryKey: ["daily-scores", adminToken, day], queryFn: () => read({ data: { adminToken, day } }) });
  const d = q.data;
  return (
    <section className="card-elevated space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Trophy className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t({ en: "Daily scores", bn: "দৈনিক স্কোর" })}</h2>
            <p className="text-sm text-muted-foreground">{d?.version === "points100"
              ? t({ en: "Before 15 Nov 2026 this day uses the earlier 100-point score formula. Recordings never count.", bn: "১৫ নভেম্বর ২০২৬-এর আগের এই দিনে আগের ১০০-পয়েন্ট স্কোর সূত্র প্রযোজ্য। রেকর্ডিং কখনো গণনা হয় না।" })
              : t({ en: "Score = 2C + 2R + A + 4V + 1.5F (no upper limit), in effect from 15 Nov 2026. Company and self-collected work both count; entering a lead earns nothing. Recordings never count.", bn: "স্কোর = 2C + 2R + A + 4V + 1.5F (কোনো সর্বোচ্চ সীমা নেই), ১৫ নভেম্বর ২০২৬ থেকে কার্যকর। কোম্পানি ও নিজের লিড দুটোই গণনা হয়; লিড যোগ করলে কোনো পয়েন্ট নেই। রেকর্ডিং কখনো গণনা হয় না।" })}</p>
          </div>
        </div>
        <input type="date" aria-label={t({ en: "Day", bn: "দিন" })} max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
      </header>
      {q.isLoading ? <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>
        : q.isError ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>
        : !d?.formula ? <p className="text-sm text-muted-foreground">{t({ en: "Save the score formula above to see daily scores.", bn: "দৈনিক স্কোর দেখতে উপরের সূত্রটি সংরক্ষণ করুন।" })}</p>
        : d.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t({ en: "No agents found.", bn: "কোনো এজেন্ট নেই।" })}</p>
        : (
          <>
            <ul className="space-y-2 md:hidden">
              {d.rows.map((r) => (
                <li key={r.agentId} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{r.name}</span><span className="text-lg font-semibold">{r.total}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.parts.map((p) => `${p.letter} ${p.count}×${p.points} → ${p.earned}`).join(" · ")}</p>
                </li>
              ))}
            </ul>
            <div className="table-scroll hidden md:block">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-3">{t({ en: "Agent", bn: "এজেন্ট" })}</th>
                  {d.formula && (["C", "R", "A", "V", "F"] as const).map((l) => <th key={l} className="py-2 pr-3" title={d.formula!.letters[l].label}>{l} <span className="font-normal">({d.formula!.letters[l].points})</span></th>)}
                  <th className="py-2 text-right">{t({ en: "Score", bn: "স্কোর" })}</th>
                </tr></thead>
                <tbody>{d.rows.map((r) => (
                  <tr key={r.agentId} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    {r.parts.map((p) => <td key={p.letter} className="py-2 pr-3 tabular-nums">{p.earned} <span className="text-xs text-muted-foreground">({p.count}×{p.points})</span></td>)}
                    <td className="py-2 text-right text-base font-semibold tabular-nums">{r.total}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </>
        )}
    </section>
  );
}
