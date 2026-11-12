import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { demeritTotals } from "@/lib/demerits";
import { cancelAgentDemerit, listAgentDemerits } from "@/lib/demerits.functions";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

type Data = Awaited<ReturnType<typeof listAgentDemerits>>;
type Entry = Data["entries"][number];

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}

/** Permanent demerit log: one point per system block; only HQ may cancel, with a reason. */
export function DemeritLog() {
  const t = useT();
  const adminToken = useAdminToken();
  const list = useServerFn(listAgentDemerits);
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric" }).format(new Date()));
  const q = useQuery({ queryKey: ["agent-demerits", year, adminToken], queryFn: () => list({ data: { adminToken, year } }), enabled: Boolean(adminToken) });

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <Ban className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t({ en: `Demerit points ${year}`, bn: `ডিমেরিট পয়েন্ট ${year}` })}</h2>
          <p className="text-sm text-muted-foreground">{t({
            en: "Each system block (accountability review) is one permanent point for the annual evaluation. Only Executive HQ can cancel a point, with a written reason; the cancellation is kept on record.",
            bn: "প্রতিটি সিস্টেম-ব্লক (জবাবদিহি রিভিউ) বার্ষিক মূল্যায়নের জন্য ১টি স্থায়ী পয়েন্ট। শুধু এক্সিকিউটিভ HQ লিখিত কারণসহ পয়েন্ট বাতিল করতে পারে; বাতিলের রেকর্ডও থেকে যায়।",
          })}</p>
        </div>
      </div>
      {!adminToken ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Unlock with your PIN to see demerits.", bn: "ডিমেরিট দেখতে পিন দিয়ে খুলুন।" })}</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>
      ) : q.isPending ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>
      ) : (
        <Body data={q.data} />
      )}
    </section>
  );
}

function Body({ data }: { data: Data }) {
  const t = useT();
  const totals = demeritTotals(data.entries);
  const agents = [...new Map(data.entries.map((e) => [e.agentId, e.agentName])).entries()]
    .map(([id, name]) => ({ id, name, ...(totals.get(id) ?? { points: 0, cancelled: 0 }) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  if (!agents.length) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t({ en: "No demerits this year.", bn: "এ বছর কোনো ডিমেরিট নেই।" })}</p>;
  return (
    <ul className="space-y-2">
      {agents.map((a) => (
        <li key={a.id} className="rounded-xl border border-border bg-background p-3">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{a.name}</span>
              <span className="text-sm tabular-nums">
                <strong>{a.points}</strong> {t({ en: "points", bn: "পয়েন্ট" })}
                {a.cancelled > 0 && <span className="text-muted-foreground"> · {a.cancelled} {t({ en: "cancelled", bn: "বাতিল" })}</span>}
              </span>
            </summary>
            <ul className="mt-2 space-y-2 border-t border-border pt-2">
              {data.entries.filter((e) => e.agentId === a.id).map((e) => <EntryRow key={e.reviewId} e={e} canCancel={data.canCancel} />)}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}

function EntryRow({ e, canCancel }: { e: Entry; canCancel: boolean }) {
  const t = useT();
  const adminToken = useAdminToken();
  const cancel = useServerFn(cancelAgentDemerit);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => cancel({ data: { adminToken, reviewId: e.reviewId, reason } }),
    onSuccess: () => { toast.success(t({ en: "Demerit cancelled", bn: "ডিমেরিট বাতিল হয়েছে" })); setOpen(false); void qc.invalidateQueries({ queryKey: ["agent-demerits"] }); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
  });
  return (
    <li className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={e.cancelled ? "text-muted-foreground line-through" : ""}>
          {fmtDate(e.businessDate)} · {e.pendingPercent}% {t({ en: "pending", bn: "বাকি" })}
        </span>
        {!e.cancelled && canCancel && !open && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t({ en: "Cancel point", bn: "পয়েন্ট বাতিল" })}</Button>}
      </div>
      {e.cancelled && <p className="text-xs text-muted-foreground">{t({ en: "Cancelled by HQ:", bn: "HQ বাতিল করেছে:" })} {e.cancelled.reason}</p>}
      {open && (
        <div className="space-y-2">
          <Textarea rows={2} maxLength={1000} value={reason} onChange={(ev) => setReason(ev.target.value)} aria-label={t({ en: "Reason", bn: "কারণ" })} placeholder={t({ en: "Why is this point cancelled? (required)", bn: "কেন পয়েন্ট বাতিল? (আবশ্যক)" })} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={reason.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>{t({ en: "Confirm cancel", bn: "বাতিল নিশ্চিত" })}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t({ en: "Back", bn: "ফিরে যান" })}</Button>
          </div>
        </div>
      )}
    </li>
  );
}
