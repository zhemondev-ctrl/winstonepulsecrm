import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PhoneCall } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Badge } from "@/components/ui/badge";
import { readCallRecords } from "@/lib/call-records.functions";
import { dhakaDay } from "@/lib/lead-groups";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/call-records")({
  head: () => ({
    meta: [
      { title: "Call records — Winstone Pulse" },
      { name: "description", content: "HQ/IT read-only call records per agent, with phone call-log confirmation and AI summaries." },
      { property: "og:title", content: "Call records — Winstone Pulse" },
      { property: "og:description", content: "Each agent's synced calls, call-log confirmed answers and leads reached per day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <RoleGate allow={["authority"]} icon={<PhoneCall className="size-7" />} title="কল রেকর্ড · Call records" description="শুধু HQ / IT — পিন দিয়ে খুলুন।">
        <Board />
      </RoleGate>
    </AppShell>
  ),
});

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function Board() {
  const t = useT();
  const adminToken = useAdminToken();
  const today = dhakaDay(new Date().toISOString());
  const week = dhakaDay(new Date(Date.now() - 6 * 864e5).toISOString());
  const [from, setFrom] = useState(week);
  const [to, setTo] = useState(today);
  const [agentId, setAgentId] = useState("");
  const [page, setPage] = useState(0);
  const read = useServerFn(readCallRecords);
  const q = useQuery({ queryKey: ["call-records", adminToken, from, to, agentId], queryFn: () => read({ data: { adminToken, from, to, agentId: agentId || null } }) });
  const d = q.data;
  const input = "h-10 rounded-md border border-input bg-background px-3 text-sm";
  const rows = d?.rows.slice(page * 50, page * 50 + 50) ?? [];
  const maxDay = Math.max(1, ...(d?.leadsPerDay.map((x) => x.leads) ?? [1]));
  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">{t({ en: "Call records", bn: "কল রেকর্ড" })}</h1>
        <p className="text-sm text-muted-foreground">{t({ en: "Read-only. A call counts as answered only when the phone's own call log recorded talk time — the app's 'connected' flag never counts.", bn: "শুধু দেখা যাবে। ফোনের নিজস্ব কল লগে কথার সময় থাকলেই কল উত্তর দেওয়া গণ্য — অ্যাপের 'connected' চিহ্ন গণ্য নয়।" })}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <input type="date" aria-label="From" className={input} value={from} max={to} onChange={(e) => { e.target.value && setFrom(e.target.value); setPage(0); }} />
        <input type="date" aria-label="To" className={input} value={to} min={from} max={today} onChange={(e) => { e.target.value && setTo(e.target.value); setPage(0); }} />
        <select aria-label="Agent" className={input} value={agentId} onChange={(e) => { setAgentId(e.target.value); setPage(0); }}>
          <option value="">{t({ en: "All agents", bn: "সব এজেন্ট" })}</option>
          {d?.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {q.isLoading ? <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>
        : q.isError ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>
        : d && (<>
          <section className="card-elevated space-y-3 p-4">
            <h2 className="font-semibold">{t({ en: "Leads reached per day (call-log confirmed)", bn: "প্রতিদিন পৌঁছানো লিড (কল লগে নিশ্চিত)" })}</h2>
            {d.leadsPerDay.length === 0 ? <p className="text-sm text-muted-foreground">{t({ en: "No confirmed answered calls in this range.", bn: "এই সময়ে নিশ্চিত উত্তর দেওয়া কল নেই।" })}</p> : (
              <ul className="space-y-1">{d.leadsPerDay.map((x) => (
                <li key={x.day} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 tabular-nums">{x.day}</span>
                  <span className="h-3 rounded bg-primary" style={{ width: `${(x.leads / maxDay) * 70}%` }} />
                  <span className="tabular-nums font-medium">{x.leads}</span>
                </li>))}</ul>)}
          </section>
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.perAgent.map((a) => (
              <div key={a.agentId} className="card-elevated p-3">
                <p className="truncate font-medium">{a.agent}</p>
                <p className="text-sm text-muted-foreground">{t({ en: `${a.calls} calls · ${a.confirmed} answered (call log)`, bn: `${a.calls} কল · ${a.confirmed} উত্তর (কল লগ)` })}</p>
              </div>))}
          </section>
          <section className="space-y-2">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">{t({ en: "No calls in this range.", bn: "এই সময়ে কোনো কল নেই।" })}</p>}
            {rows.map((r) => (
              <article key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{r.agent}</span>
                  <span className="text-muted-foreground">{r.phone} · {fmt(r.at)} · {r.seconds ?? 0}s · {r.source ?? "—"}</span>
                  <Badge variant={r.confirmed ? "default" : "secondary"}>{r.confirmed ? t({ en: "Answered · call log", bn: "উত্তর · কল লগ" }) : t({ en: "Not confirmed", bn: "নিশ্চিত নয়" })}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.summary ?? t({ en: "No AI summary", bn: "AI সারাংশ নেই" })}</p>
              </article>))}
            {d.rows.length > 50 && (
              <div className="flex items-center gap-2 text-sm">
                <button className={input} disabled={page === 0} onClick={() => setPage(page - 1)}>{t({ en: "Previous", bn: "আগের" })}</button>
                <span>{page + 1} / {Math.ceil(d.rows.length / 50)}</span>
                <button className={input} disabled={(page + 1) * 50 >= d.rows.length} onClick={() => setPage(page + 1)}>{t({ en: "Next", bn: "পরের" })}</button>
              </div>)}
          </section>
        </>)}
    </div>
  );
}
