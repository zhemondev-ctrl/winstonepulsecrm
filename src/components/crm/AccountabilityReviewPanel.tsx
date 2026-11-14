import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { SectionGroup, GroupState } from "@/components/crm/groups";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { approveAllAccountability, listAccountabilityReviews, reviewAccountability } from "@/lib/accountability.functions";
import { type AccountabilityStatus } from "@/lib/accountability";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

type HistoryEntry = { action: string; at: string; by: string; note: string | null };

const TONE: Record<AccountabilityStatus, string> = {
  review_required: "border-warning/50 bg-warning/15 text-foreground",
  hold: "border-destructive/40 bg-destructive/10 text-destructive",
  approved: "border-success/40 bg-success/15 text-foreground",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** Server-approved HQ and full IT PIN reviewers share the existing audit path. */
export function AccountabilityReviewPanel({ surface }: { surface: "hq" | "it" }) {
  const t = useT();
  const label = (en: string, bn: string) => t({ en, bn });
  const stateLabel = (status: string) => status === "approved" ? label("Approved", "অনুমোদিত") : status === "hold" ? label("On hold", "স্থগিত") : label("Review required", "পর্যালোচনা প্রয়োজন");
  const adminToken = useAdminToken();
  const list = useServerFn(listAccountabilityReviews);
  const review = useServerFn(reviewAccountability);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const q = useQuery({
    queryKey: ["accountability-reviews", adminToken],
    queryFn: () => list({ data: { adminToken, days: 30 } }),
    enabled: Boolean(adminToken),
  });

  const act = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "hold" | "note" }) =>
      review({ data: { adminToken, id: v.id, action: v.action, note: note.trim() || undefined } }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "approve" ? label("Next-day unlock approved", "পরের দিনের কাজ অনুমোদিত") : v.action === "hold" ? label("Kept on hold", "স্থগিত রাখা হয়েছে") : label("Note added", "মন্তব্য যোগ হয়েছে"));
      setNote("");
      qc.invalidateQueries({ queryKey: ["accountability-reviews"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const approveAll = useServerFn(approveAllAccountability);
  const all = useMutation({
    mutationFn: () => approveAll({ data: { adminToken, days: 30 } }),
    onSuccess: (r) => {
      toast.success(label(`${r.approved} of ${r.total} reviews approved`, `${r.total}টির মধ্যে ${r.approved}টি অনুমোদিত`));
      qc.invalidateQueries({ queryKey: ["accountability-reviews"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  const allRows = q.data?.reviews ?? [];
  const rows = surface === "it" && !showHistory ? allRows.filter(r => r.status !== "approved") : allRows;
  const canApprove = Boolean(q.data?.canApprove);
  const open = rows.find((r) => r.id === openId) ?? null;
  const history = (open?.review_history ?? []) as HistoryEntry[];
  const prior = open ? rows.filter((r) => r.agent_id === open.agent_id && r.id !== open.id) : [];
  const waiting = rows.filter((r) => r.status !== "approved").length;

  return (
    <SectionGroup
      eyebrow={surface === "hq" ? label("Executive HQ", "এক্সিকিউটিভ HQ") : label("IT Console", "আইটি কনসোল")}
      title={surface === "it" ? label("Handout eligibility / Pending review", "বণ্টনের যোগ্যতা / অপেক্ষমাণ পর্যালোচনা") : label("Daily Accountability / Pending Review", "দৈনিক জবাবদিহি / অপেক্ষমাণ পর্যালোচনা")}
      subtitle={
        surface === "hq"
          ? label("Pending-work reviews. HQ or full IT PIN approval opens the next-day queue.", "বাকি কাজের পর্যালোচনা। HQ বা পূর্ণ IT পিনের অনুমোদনে পরের দিনের কাজ খুলবে।")
          : label("Saved pending-work reviews · next-day unlock decisions. Lead assignment stays in LeadHub Nexus.", "সংরক্ষিত বাকি কাজের পর্যালোচনা ও পরের দিনের অনুমোদন। লিড বণ্টন LeadHub Nexus-এ থাকবে।")
      }
      count={waiting}
    >
      {surface === "it" && <div className="mb-3 flex justify-end"><Button size="sm" variant="outline" onClick={() => setShowHistory(v => !v)}>{showHistory ? label("Pending only", "শুধু অপেক্ষমাণ") : label("Show review history", "পর্যালোচনার ইতিহাস")}</Button></div>}
      {q.isPending ? (
        <GroupState kind="loading" />
      ) : q.isError ? (
        <GroupState kind="error" message={q.error instanceof Error ? q.error.message : "Could not load"} />
      ) : rows.length === 0 ? (
        <GroupState kind="empty" message={label("No pending-review records in the last 30 days", "গত ৩০ দিনে অপেক্ষমাণ পর্যালোচনা নেই")} />
      ) : (
        <>
        {canApprove && waiting > 0 ? (
          <div className="mb-3 flex justify-end">
            <Button
              className="w-full sm:w-auto"
              disabled={all.isPending}
              onClick={() => { if (window.confirm(label(`Approve next-day unlock for all ${waiting} waiting reviews (including ones on hold)?`, `${waiting}টি অপেক্ষমাণ ও স্থগিত পর্যালোচনার পরের দিনের কাজ অনুমোদন করবেন?`))) all.mutate(); }}
            >
              {all.isPending ? label("Approving…", "অনুমোদন হচ্ছে…") : label(`Approve all (${waiting})`, `সব অনুমোদন (${waiting})`)}
            </Button>
          </div>
        ) : null}
        <ul className="space-y-2 md:hidden">
          {rows.map((r) => {
            const agent = r.agent as { name?: string; employee_id?: string } | null;
            const st = r.status as AccountabilityStatus;
            return <li key={r.id} className="rounded-lg border border-border p-3 text-xs">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><div className="min-w-0"><p className="truncate font-semibold">{agent?.name ?? "—"}</p><p className="text-muted-foreground">{agent?.employee_id ?? ""} · {r.business_date}</p></div><span className={`self-start rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE[st]}`}>{stateLabel(st)}</span></div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center"><div><dt className="text-muted-foreground">{label("Eligible", "যোগ্য কাজ")}</dt><dd className="tabular font-semibold">{r.eligible_count}</dd></div><div><dt className="text-muted-foreground">{label("Done", "সম্পন্ন")}</dt><dd className="tabular font-semibold">{r.completed_count}</dd></div><div><dt className="text-muted-foreground">{label("Pending", "বাকি")}</dt><dd className="tabular font-semibold">{r.pending_count} · {r.pending_percent}%</dd></div></dl>
              <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => { setNote(""); setOpenId(r.id); }}>{label("Review details", "বিস্তারিত পর্যালোচনা")}</Button>
            </li>;
          })}
        </ul>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">{label("Agent", "এজেন্ট")}</th><th className="pr-3">{label("Business date", "কাজের তারিখ")}</th>
                <th className="pr-3 text-right">{label("Eligible", "যোগ্য কাজ")}</th><th className="pr-3 text-right">{label("Done", "সম্পন্ন")}</th>
                <th className="pr-3 text-right">{label("Pending", "বাকি")}</th><th className="pr-3 text-right">%</th>
                <th className="pr-3 text-right">{label("Overdue FU", "বকেয়া ফলো-আপ")}</th><th className="pr-3 text-right">{label("Incomplete reports", "অসম্পূর্ণ রিপোর্ট")}</th>
                <th className="pr-3">{label("State", "অবস্থা")}</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const agent = r.agent as { name?: string; employee_id?: string } | null;
                const st = r.status as AccountabilityStatus;
                return (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{agent?.name ?? "—"} <span className="text-muted-foreground">{agent?.employee_id ?? ""}</span></td>
                    <td className="pr-3 tabular">{r.business_date}</td>
                    <td className="pr-3 text-right tabular">{r.eligible_count}</td>
                    <td className="pr-3 text-right tabular">{r.completed_count}</td>
                    <td className="pr-3 text-right tabular">{r.pending_count}</td>
                    <td className="pr-3 text-right tabular font-semibold">{r.pending_percent}%</td>
                    <td className="pr-3 text-right tabular">{r.overdue_followups}</td>
                    <td className="pr-3 text-right tabular">{r.missed_reports}</td>
                    <td className="pr-3"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE[st]}`}>{stateLabel(st)}</span></td>
                    <td className="text-right"><Button size="sm" variant="outline" onClick={() => { setNote(""); setOpenId(r.id); }}>{label("Review details", "বিস্তারিত পর্যালোচনা")}</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Dialog open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {(open.agent as { name?: string } | null)?.name ?? "Agent"} — {open.business_date}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="rounded-xl border border-border bg-surface-2/60 p-3 text-xs">{open.trigger_reason}</p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-muted-foreground">{label("Assigned eligible leads", "অ্যাসাইন করা যোগ্য লিড")}</dt><dd className="tabular">{open.assigned_count}</dd>
                  <dt className="text-muted-foreground">{label("Total workload (incl. due follow-ups)", "মোট কাজ (ফলো-আপসহ)")}</dt><dd className="tabular">{open.eligible_count}</dd>
                  <dt className="text-muted-foreground">{label("Completed / contacted", "সম্পন্ন / যোগাযোগ হয়েছে")}</dt><dd className="tabular">{open.completed_count}</dd>
                  <dt className="text-muted-foreground">{label("Pending", "বাকি")}</dt><dd className="tabular">{open.pending_count} ({open.pending_percent}%)</dd>
                  <dt className="text-muted-foreground">{label("Overdue follow-ups", "বকেয়া ফলো-আপ")}</dt><dd className="tabular">{open.overdue_followups}</dd>
                  <dt className="text-muted-foreground">{label("Incomplete reports", "অসম্পূর্ণ রিপোর্ট")}</dt><dd className="tabular">{open.missed_reports}</dd>
                  <dt className="text-muted-foreground">{label("Unlock for date", "কাজ খোলার তারিখ")}</dt><dd className="tabular">{open.unlock_for_date}</dd>
                  <dt className="text-muted-foreground">{label("Reviewed", "পর্যালোচিত")}</dt><dd>{open.reviewed_by ? `${open.reviewed_by}, ${fmt(open.reviewed_at)}` : "—"}</dd>
                </dl>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label("Evidence timeline", "প্রমাণের ইতিহাস")}</p>
                  <ol className="space-y-1 text-xs">
                    {history.map((h, i) => (
                      <li key={i} className="border-l-2 border-primary/40 pl-2">
                        <span className="font-medium">{h.action}</span> · {h.by} · {fmt(h.at)}
                        {h.note ? <span className="block text-muted-foreground">{h.note}</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label("Previous reviews", "আগের পর্যালোচনা")}</p>
                  {prior.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{label("None in the last 30 days.", "গত ৩০ দিনে নেই।")}</p>
                  ) : (
                    <ul className="space-y-0.5 text-xs">
                      {prior.map((p) => (
                        <li key={p.id}>{p.business_date} — {p.pending_percent}% — {stateLabel(p.status)}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {canApprove ? (
                  <div className="space-y-2">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={label("Review note (required for Hold / Add note)", "পর্যালোচনার মন্তব্য (স্থগিত বা মন্তব্য যোগ করতে আবশ্যক)")} maxLength={1000} />
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={act.isPending || open.status === "approved"} onClick={() => act.mutate({ id: open.id, action: "approve" })}>{label("Approve Next-Day Unlock", "পরের দিনের কাজ অনুমোদন")}</Button>
                      <Button variant="outline" disabled={act.isPending || !note.trim()} onClick={() => act.mutate({ id: open.id, action: "hold" })}>{label("Keep On Hold", "স্থগিত রাখুন")}</Button>
                      <Button variant="ghost" disabled={act.isPending || !note.trim()} onClick={() => act.mutate({ id: open.id, action: "note" })}>{label("Add review note", "পর্যালোচনার মন্তব্য যোগ করুন")}</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {label("Unlock with the Executive HQ or full IT PIN to act.", "সিদ্ধান্ত দিতে HQ বা পূর্ণ IT পিন দিয়ে খুলুন।")}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SectionGroup>
  );
}
