import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CalendarDays, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { DailyScoresPanel } from "@/components/crm/hq/DailyScoresPanel";
import { Button } from "@/components/ui/button";
import { readScoreVersions } from "@/lib/score-formula.functions";
import { dhakaDay } from "@/lib/lead-groups";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/score-versions")({
  head: () => ({ meta: [
    { title: "Dated score versions — Winstone Pulse" },
    { name: "description", content: "Executive HQ daily scores with dated formula versions and separate historical calculations." },
    { property: "og:title", content: "Dated score versions — Winstone Pulse" },
    { property: "og:description", content: "Review each Dhaka day's applicable score formula and agent results." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ScoreVersionPage,
});

function ScoreVersionPage() {
  return <AppShell><RoleGate surface="hq" allow={["authority"]} icon={<CalendarDays className="size-7" />} title="স্কোর সংস্করণ · Score versions" description="Executive HQ · পিন দিয়ে খুলুন"><ScoreVersionBoard /></RoleGate></AppShell>;
}

function ScoreVersionBoard() {
  const t = useT();
  const adminToken = useAdminToken();
  const today = dhakaDay(new Date().toISOString());
  const [day, setDay] = useState(today);
  const read = useServerFn(readScoreVersions);
  const q = useQuery({ queryKey: ["score-versions", adminToken], queryFn: () => read({ data: { adminToken } }) });
  const versions = q.data?.versions ?? [];
  const active = versions.filter(v => v.effective_from <= day).at(-1);
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
    <Button asChild variant="ghost"><Link to="/hq" search={{ s: "kpis" }}><ArrowLeft className="size-4" />Executive HQ</Link></Button>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">{t({ en: "Dated score versions", bn: "তারিখভিত্তিক স্কোর সংস্করণ" })}</h1><p className="text-sm text-muted-foreground">{t({ en: "Dhaka day · Read-only", bn: "ঢাকার দিন · শুধু দেখা যাবে" })}</p></div>
      <label className="space-y-1 text-sm"><span className="block">{t({ en: "Score date", bn: "স্কোরের তারিখ" })}</span><input aria-label="Score date" type="date" max={today} value={day} onChange={e => e.target.value && setDay(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3" /></label>
    </header>
    <section className="space-y-3 border-y border-border py-4">
      <h2 className="font-semibold">{t({ en: "Formula timeline", bn: "সূত্রের সময়রেখা" })}</h2>
      {q.isPending ? <p role="status">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p> : q.isError ? <div role="alert"><p className="text-destructive">{t({ en: "Score versions unavailable", bn: "স্কোর সংস্করণ পাওয়া যাচ্ছে না" })}</p><Button variant="secondary" onClick={() => void q.refetch()}><RefreshCw className="size-4" />{t({ en: "Retry", bn: "আবার চেষ্টা" })}</Button></div> : <ol className="space-y-2 text-sm">
        <li className={!active ? "font-semibold" : "text-muted-foreground"}>V1 · {t({ en: "Earlier 100-point formula", bn: "আগের ১০০-পয়েন্ট সূত্র" })}{versions[0] ? ` · ${t({ en: "Before", bn: "এর আগে" })} ${versions[0].effective_from}` : ""}</li>
        {versions.map(v => <li key={v.id} className={active?.id === v.id ? "font-semibold" : "text-muted-foreground"}>{v.formula === "policy_v2" ? "V2 · 2C + 2R + A + 4V + 1.5F" : v.formula === "points100" ? "V1 · 100" : t({ en: "Unsupported version", bn: "অজানা সংস্করণ" })} · {v.effective_from}{v.effective_from > today ? ` · ${t({ en: "Scheduled", bn: "নির্ধারিত" })}` : ""}</li>)}
      </ol>}
    </section>
    {q.isSuccess && <DailyScoresPanel selectedDay={day} />}
  </main>;
}