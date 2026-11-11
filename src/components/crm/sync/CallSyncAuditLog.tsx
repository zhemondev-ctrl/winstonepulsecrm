import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getAdminToken } from "@/lib/local-session";
import { listCallSyncAudit } from "@/lib/android-sync-failures.functions";
import { formatDhaka } from "@/lib/android-sync-failures";
import { RETRY_LABEL, type CallSyncAuditEntry, type RetryState } from "@/lib/call-sync-audit";

const VARIANT: Record<RetryState, "secondary" | "outline" | "destructive"> = { saved: "outline", retrying: "secondary", stopped: "destructive" };
const PAGE = 50;

export function CallSyncAuditLog({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const fn = useServerFn(listCallSyncAudit);
  const [filter, setFilter] = useState<RetryState | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const q = useQuery({
    queryKey: ["call-sync-audit", fromIso.slice(0, 16), toIso.slice(0, 16)],
    queryFn: () => fn({ data: { adminToken: getAdminToken(), fromIso, toIso } }),
    staleTime: 30_000,
  });
  const rows = useMemo(() => (q.data?.entries ?? []).filter((e) => filter === "all" || e.state === filter), [q.data, filter]);

  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label="Call sync audit log">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">কল সিঙ্ক অডিট লগ · Call sync audit log</h2>
          <p className="text-xs text-muted-foreground">Every call result the phone sent: saved, or failed with the reason and whether the phone is still retrying. Read-only.</p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="csa-filter">
          Show
          <select id="csa-filter" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={filter}
            onChange={(e) => { setFilter(e.target.value as RetryState | "all"); setShown(PAGE); }}>
            <option value="all">All</option>
            <option value="saved">Saved</option>
            <option value="retrying">Retrying</option>
            <option value="stopped">Stopped</option>
          </select>
        </label>
      </div>

      {q.isLoading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p>
      ) : q.error ? (
        <p role="alert" className="text-sm text-destructive">Could not load the call sync audit log.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
            {(["saved", "retrying", "stopped"] as const).map((s) => (
              <div key={s} className="rounded-lg border border-border p-2">
                <p className="text-muted-foreground">{RETRY_LABEL[s].split(" · ")[0]}</p>
                <p className={`text-lg font-semibold tabular-nums ${s === "stopped" && q.data!.totals.stopped ? "text-destructive" : ""}`}>{q.data!.totals[s]}</p>
              </div>
            ))}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">A failure is not marked as delivered later: saved entries carry no call fingerprint, so the two cannot be proven to be the same call.</p>
          {q.data!.capped && <p className="mb-3 text-xs">Showing the newest 3,000 of each kind only. Pick a shorter range.</p>}
          {!rows.length ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No call sync entries in this range.</p>
          ) : (
            <>
              <ul className="space-y-2 md:hidden">
                {rows.slice(0, shown).map((e) => <Card key={e.id} e={e} />)}
              </ul>
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="py-1 pr-3 font-medium">Time (Dhaka)</th><th className="py-1 pr-3 font-medium">Agent</th><th className="py-1 pr-3 font-medium">What</th><th className="py-1 pr-3 font-medium">Result</th><th className="py-1 pr-3 font-medium">Reason</th><th className="py-1 pr-3 text-right font-medium">Attempts</th><th className="py-1 font-medium">Ref</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, shown).map((e) => (
                      <tr key={e.id} className="border-t border-border align-top">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{formatDhaka(e.atUtc)}</td>
                        <td className="py-1.5 pr-3">{e.agentName}</td>
                        <td className="py-1.5 pr-3">{e.what}</td>
                        <td className="py-1.5 pr-3"><Badge variant={VARIANT[e.state]}>{RETRY_LABEL[e.state]}</Badge></td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{e.reason ? <span title={e.nextStep ?? undefined}>{e.reason}{e.httpStatus ? ` (HTTP ${e.httpStatus})` : ""}</span> : "—"}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{e.attempts ?? "—"}{e.timesSeen && e.timesSeen > 1 ? ` · ${e.timesSeen}×` : ""}</td>
                        <td className="py-1.5 font-mono text-xs text-muted-foreground">{e.callRef ?? (e.leadId ? `lead ${e.leadId.slice(0, 8)}` : "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > shown && (
                <button type="button" className="mt-3 text-sm font-medium underline" onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({rows.length - shown} left)
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Card({ e }: { e: CallSyncAuditEntry }) {
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{formatDhaka(e.atUtc)}</span>
        <span>{e.agentName}</span>
      </div>
      <p className="mt-1">{e.what}</p>
      <Badge className="mt-1" variant={VARIANT[e.state]}>{RETRY_LABEL[e.state]}</Badge>
      {e.reason && <p className="mt-1 text-muted-foreground">{e.reason} · {e.attempts ?? 0} attempts{e.timesSeen && e.timesSeen > 1 ? ` · ${e.timesSeen}×` : ""}</p>}
      {e.nextStep && <p className="mt-1 text-xs text-muted-foreground">{e.nextStep}</p>}
    </li>
  );
}
