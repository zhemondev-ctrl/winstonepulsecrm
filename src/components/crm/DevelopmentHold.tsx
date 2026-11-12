import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Construction, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  architectConfirmDevelopmentHold,
  architectDevelopmentHold,
  architectStartDevelopmentHold,
  itDevelopmentHold,
  itStartDevelopmentHold,
} from "@/lib/development-hold.functions";
import { DEVELOPMENT_HOLD_BODY, DEVELOPMENT_HOLD_TITLE } from "@/lib/development-hold";
import { dhakaTime } from "@/lib/maintenance-rules";
import { useT } from "@/lib/i18n";

/** Full-screen official notice for everyone who is not IT Console / Architect. */
export function DevelopmentHoldScreen({ startedAt, signIn }: { startedAt: string | null; signIn?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/95 p-4 backdrop-blur" role="alertdialog" aria-labelledby="dev-hold-title">
      <div className="card-elevated w-full max-w-md space-y-4 border-warning/50 p-6">
        <h1 id="dev-hold-title" className="flex items-start gap-2 text-lg font-bold">
          <Construction className="mt-0.5 size-5 shrink-0 text-warning" />
          <span>{t(DEVELOPMENT_HOLD_TITLE)}</span>
        </h1>
        <p className="text-sm leading-relaxed">{t(DEVELOPMENT_HOLD_BODY)}</p>
        {startedAt && (
          <p className="text-xs text-muted-foreground">
            {t({ bn: "নোটিশ শুরু", en: "Notice started" })}: {dhakaTime(startedAt)} ({t({ bn: "ঢাকা", en: "Dhaka" })})
          </p>
        )}
        {signIn}
      </div>
    </div>
  );
}

function StatusLine({ active, startedAt, startedBy }: { active: boolean; startedAt: string | null; startedBy: string | null }) {
  const t = useT();
  return active ? (
    <p className="text-sm font-semibold text-warning">
      {t({ bn: "চালু — স্টাফরা এখন CRM ব্যবহার করতে পারছেন না", en: "ON — staff cannot use the CRM now" })}
      <span className="block text-xs font-normal text-muted-foreground">
        {dhakaTime(startedAt)} · {startedBy ?? "—"}
      </span>
    </p>
  ) : (
    <p className="text-sm font-semibold text-success">{t({ bn: "বন্ধ — CRM সবার জন্য খোলা", en: "OFF — CRM is open for everyone" })}</p>
  );
}

/** IT Console: can start the notice, never end it. */
export function ItDevelopmentHoldCard({ adminToken }: { adminToken: string }) {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dev-hold", "it"], queryFn: () => itDevelopmentHold({ data: { adminToken } }), refetchInterval: 30_000 });
  const start = useMutation({
    mutationFn: () => itStartDevelopmentHold({ data: { adminToken } }),
    onSuccess: () => {
      toast.success(t({ bn: "নোটিশ চালু হয়েছে", en: "Notice is on" }));
      void qc.invalidateQueries({ queryKey: ["dev-hold"] });
      void qc.invalidateQueries({ queryKey: ["maintenance-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="space-y-2 rounded-lg border border-warning/40 p-3" aria-labelledby="it-dev-hold">
      <h3 id="it-dev-hold" className="flex items-center gap-2 text-sm font-semibold">
        <Construction className="size-4 text-warning" /> {t({ bn: "আজকের অফিসিয়াল নোটিশ: ডেভেলপমেন্ট চলছে", en: "Today's official notice: development in progress" })}
      </h3>
      {q.isLoading ? <Loader2 className="size-4 animate-spin" /> : q.data ? <StatusLine {...q.data} /> : <p className="text-xs text-destructive">{(q.error as Error)?.message}</p>}
      <p className="text-xs text-muted-foreground">
        {t({ bn: "চালু করলে IT Console ছাড়া সবাই (এজেন্ট, HQ, ফোন অ্যাপ) বন্ধ থাকবে। শুধু System Architect নিশ্চিত করে আবার খুলতে পারবেন।", en: "When on, everyone except IT Console (agents, HQ, phone app) is closed out. Only the System Architect can confirm and reopen." })}
      </p>
      {q.data && !q.data.active && (
        <Button
          variant="destructive"
          size="sm"
          disabled={start.isPending}
          onClick={() => {
            if (window.confirm(t({ bn: "এখনই সবার জন্য CRM বন্ধ করবেন?", en: "Close the CRM for everyone now?" }))) start.mutate();
          }}
        >
          {t({ bn: "নোটিশ চালু করুন", en: "Turn notice on" })}
        </Button>
      )}
    </section>
  );
}

/** System Architect: start the notice or confirm the work is done and reopen. */
export function ArchitectDevelopmentHoldCard({ session }: { session: string }) {
  const t = useT();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: ["dev-hold", "architect"], queryFn: () => architectDevelopmentHold({ data: { session } }), refetchInterval: 30_000, retry: false });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dev-hold"] });
    void qc.invalidateQueries({ queryKey: ["architect-overview"] });
  };
  const start = useMutation({
    mutationFn: () => architectStartDevelopmentHold({ data: { session } }),
    onSuccess: () => { toast.success("Notice is on — CRM closed for staff"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirm = useMutation({
    mutationFn: () => architectConfirmDevelopmentHold({ data: { session, note } }),
    onSuccess: () => { setNote(""); toast.success("Confirmed — CRM is open again"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const hold = q.data;
  return (
    <section className={`card-elevated space-y-3 p-4 ${hold?.active ? "border-warning/50" : ""}`} aria-labelledby="arch-dev-hold">
      <h2 id="arch-dev-hold" className="flex items-center gap-2 text-base font-semibold">
        <Construction className="size-5 text-warning" /> {t({ bn: "অফিসিয়াল নোটিশ: ডেভেলপমেন্ট চলছে", en: "Official notice: development in progress" })}
      </h2>
      {q.isLoading ? <Loader2 className="size-4 animate-spin" /> : hold ? <StatusLine {...hold} /> : <p className="text-xs text-destructive">{(q.error as Error)?.message}</p>}
      {hold?.active ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            confirm.mutate();
          }}
        >
          <label htmlFor="dev-hold-note" className="text-xs text-muted-foreground">
            {t({ bn: "কী নিশ্চিত করছেন (অডিটের জন্য)", en: "What you are confirming (for the audit log)" })}
          </label>
          <Input id="dev-hold-note" value={note} maxLength={300} placeholder={t({ bn: "যেমন: আজকের আপডেট পরীক্ষা করা হয়েছে", en: "e.g. Today's update checked" })} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={confirm.isPending || note.trim().length < 3}>
            <CheckCircle2 className="size-4" /> {t({ bn: "নিশ্চিত করুন ও CRM খুলুন", en: "Confirm & reopen CRM" })}
          </Button>
        </form>
      ) : hold ? (
        <>
          {hold.releasedAt && (
            <p className="text-xs text-muted-foreground">
              {t({ bn: "শেষ নিশ্চিতকরণ", en: "Last confirmed" })}: {dhakaTime(hold.releasedAt)} · {hold.releaseNote ?? "—"}
            </p>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={start.isPending}
            onClick={() => {
              if (window.confirm("Close the CRM for all staff now?")) start.mutate();
            }}
          >
            {t({ bn: "নোটিশ চালু করুন", en: "Turn notice on" })}
          </Button>
        </>
      ) : null}
    </section>
  );
}
