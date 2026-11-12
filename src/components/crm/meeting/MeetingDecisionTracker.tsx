import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import type { MeetingItemDecision, TrackerStage } from "@/lib/meeting-approvals";
import { listMeetingDecisions, markMeetingItemImplemented } from "@/lib/meeting-approvals.functions";

type T = ReturnType<typeof useT>;

const STAGE: Record<TrackerStage, { en: string; bn: string; tone: string }> = {
  awaiting_md: { en: "Awaiting MD approval", bn: "MD-এর অনুমোদনের অপেক্ষায়", tone: "border-warning/50 bg-warning/15 text-foreground" },
  ready: { en: "Approved — ready to implement", bn: "অনুমোদিত — চালু করা যাবে", tone: "border-success/40 bg-success/15 text-foreground" },
  implemented: { en: "Implemented", bn: "চালু হয়েছে", tone: "border-primary/40 bg-primary/10 text-foreground" },
  rejected: { en: "Rejected — no change", bn: "বাতিল — কোনো পরিবর্তন নয়", tone: "border-destructive/40 bg-destructive/10 text-destructive" },
  withdrawn: { en: "Withdrawn", bn: "প্রত্যাহার করা", tone: "border-border bg-muted text-muted-foreground" },
};

const DECISION: Record<MeetingItemDecision, { en: string; bn: string }> = {
  pending: { en: "Not decided", bn: "সিদ্ধান্ত বাকি" },
  approved: { en: "Approved", bn: "অনুমোদিত" },
  approved_with_changes: { en: "Approved with changes", bn: "পরিবর্তনসহ অনুমোদিত" },
  rejected: { en: "Rejected", bn: "বাতিল" },
};

const FILTERS: (TrackerStage | "all")[] = ["all", "awaiting_md", "ready", "implemented", "rejected"];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`));
}
function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}
function Pill({ stage, t }: { stage: TrackerStage; t: T }) {
  const s = STAGE[stage];
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.tone}`}>{t(s)}</span>;
}

/** All meeting decisions in one list. A rule change is allowed only after the MD's final written approval. */
export function MeetingDecisionTracker({ onOpenMeeting }: { onOpenMeeting: (id: string) => void }) {
  const t = useT();
  const adminToken = useAdminToken();
  const list = useServerFn(listMeetingDecisions);
  const [filter, setFilter] = useState<TrackerStage | "all">("all");
  const q = useQuery({
    queryKey: ["meeting-decisions", adminToken],
    queryFn: () => list({ data: { adminToken } }),
    enabled: Boolean(adminToken),
  });

  if (!adminToken) return <p className="text-sm text-muted-foreground">{t({ en: "Unlock with your PIN to see meeting decisions.", bn: "মিটিংয়ের সিদ্ধান্ত দেখতে পিন দিয়ে খুলুন।" })}</p>;
  if (q.isError) return <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>;
  if (q.isPending) return <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>;

  const all = q.data.rows;
  const count = (s: TrackerStage) => all.filter((r) => r.stage === s).length;
  const rows = filter === "all" ? all.filter((r) => r.stage !== "withdrawn") : all.filter((r) => r.stage === filter);

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        {t({
          en: "Every meeting decision starts as pending. No CRM rule may change until Executive HQ submits the MD's final written decision. IT can then mark an approved item implemented — rejected and pending items stay locked.",
          bn: "মিটিংয়ের প্রতিটি সিদ্ধান্ত প্রথমে অপেক্ষমাণ থাকে। এক্সিকিউটিভ HQ MD-এর চূড়ান্ত লিখিত সিদ্ধান্ত জমা না দেওয়া পর্যন্ত CRM-এর কোনো নিয়ম বদলানো যাবে না। এরপর IT শুধু অনুমোদিত বিষয়কে চালু হয়েছে বলে চিহ্নিত করতে পারবে — বাতিল ও অপেক্ষমাণ বিষয় লক থাকে।",
        })}
      </p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(["awaiting_md", "ready", "implemented", "rejected"] as TrackerStage[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? "all" : s)}
            aria-pressed={filter === s}
            className={`rounded-xl border p-3 text-left transition-colors hover:bg-accent ${filter === s ? "border-primary bg-accent" : "border-border bg-background"}`}
          >
            <p className="text-2xl font-semibold tabular-nums">{count(s)}</p>
            <p className="text-xs text-muted-foreground">{t(STAGE[s])}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t({ en: "Filter decisions", bn: "সিদ্ধান্ত ছাঁকুন" })}>
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? t({ en: "All", bn: "সব" }) : t(STAGE[f])}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t({ en: "No decisions here.", bn: "এখানে কোনো সিদ্ধান্ত নেই।" })}</p>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="space-y-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold break-words">{r.position}. {r.title}</p>
                  <Pill stage={r.stage} t={t} />
                </div>
                <button type="button" onClick={() => onOpenMeeting(r.request_id)} className="text-left text-xs text-primary underline-offset-2 hover:underline">
                  {r.meeting_title} · {fmtDate(r.meeting_date)}
                </button>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{t({ en: "MD decision", bn: "MD-এর সিদ্ধান্ত" })}</dt>
                  <dd>{t(DECISION[r.decision as MeetingItemDecision] ?? DECISION.pending)}</dd>
                  <dt className="text-muted-foreground">{t({ en: "MD date", bn: "MD-এর তারিখ" })}</dt>
                  <dd>{fmtDate(r.md_decision_date)}</dd>
                  <dt className="text-muted-foreground">{t({ en: "Signed by", bn: "স্বাক্ষর" })}</dt>
                  <dd className="break-words">{r.final_signer ?? "—"}</dd>
                </dl>
                <ImplementCell row={r} canImplement={q.data.canImplement} t={t} />
              </li>
            ))}
          </ul>
          <div className="table-scroll hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t({ en: "Decision", bn: "সিদ্ধান্ত" })}</th>
                  <th className="px-3 py-2 font-medium">{t({ en: "Meeting", bn: "মিটিং" })}</th>
                  <th className="px-3 py-2 font-medium">{t({ en: "MD decision", bn: "MD-এর সিদ্ধান্ত" })}</th>
                  <th className="px-3 py-2 font-medium">{t({ en: "MD date", bn: "MD-এর তারিখ" })}</th>
                  <th className="px-3 py-2 font-medium">{t({ en: "Signed by", bn: "স্বাক্ষর" })}</th>
                  <th className="px-3 py-2 font-medium">{t({ en: "Status", bn: "অবস্থা" })}</th>
                  <th className="px-3 py-2 font-medium">{t({ en: "Implementation", bn: "চালু করা" })}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="max-w-xs px-3 py-2">
                      <p className="font-medium break-words">{r.position}. {r.title}</p>
                      {r.decision_comment && <p className="mt-1 text-xs text-muted-foreground break-words">{r.decision_comment}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => onOpenMeeting(r.request_id)} className="text-left text-xs text-primary underline-offset-2 hover:underline">
                        {r.meeting_title}<br />{fmtDate(r.meeting_date)}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs">{t(DECISION[r.decision as MeetingItemDecision] ?? DECISION.pending)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(r.md_decision_date)}</td>
                    <td className="px-3 py-2 text-xs">{r.final_signer ?? "—"}</td>
                    <td className="px-3 py-2"><Pill stage={r.stage} t={t} /></td>
                    <td className="min-w-48 px-3 py-2"><ImplementCell row={r} canImplement={q.data.canImplement} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof listMeetingDecisions>>["rows"][number];

function ImplementCell({ row, canImplement, t }: { row: Row; canImplement: boolean; t: T }) {
  const adminToken = useAdminToken();
  const mark = useServerFn(markMeetingItemImplemented);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => mark({ data: { adminToken, itemId: row.id, note } }),
    onSuccess: () => {
      toast.success(t({ en: "Marked implemented", bn: "চালু হয়েছে বলে চিহ্নিত" }));
      setOpen(false);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["meeting-decisions"] });
      void qc.invalidateQueries({ queryKey: ["meeting-approval"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  if (row.stage === "implemented") {
    return (
      <div className="space-y-0.5 text-xs">
        <p className="flex items-center gap-1 font-medium"><CheckCircle2 className="size-3.5 text-success" />{fmtTime(row.implemented_at)}</p>
        {row.implementation_note && <p className="text-muted-foreground break-words">{row.implementation_note}</p>}
      </div>
    );
  }
  if (row.stage !== "ready") {
    return <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3.5" />{t({ en: "Locked — no rule change", bn: "লক — নিয়ম বদলানো যাবে না" })}</p>;
  }
  if (!canImplement) return <p className="text-xs text-muted-foreground">{t({ en: "Waiting for IT", bn: "IT-এর অপেক্ষায়" })}</p>;
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t({ en: "Mark implemented", bn: "চালু হয়েছে চিহ্নিত করুন" })}</Button>;
  return (
    <div className="space-y-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={2000}
        aria-label={t({ en: "What changed in the CRM", bn: "CRM-এ কী বদলানো হয়েছে" })}
        placeholder={t({ en: "What changed in the CRM (required)", bn: "CRM-এ কী বদলানো হয়েছে (আবশ্যক)" })}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={note.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>{t({ en: "Save", bn: "সংরক্ষণ" })}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t({ en: "Cancel", bn: "বাতিল" })}</Button>
      </div>
    </div>
  );
}
