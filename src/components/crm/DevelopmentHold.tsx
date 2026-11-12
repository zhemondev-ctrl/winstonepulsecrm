import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Construction, Eye, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
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
import { NoticeVideos } from "@/components/crm/NoticeVideos";

/** Full-screen official notice for everyone who is not IT Console / Architect. */
export function DevelopmentHoldScreen({
  startedAt,
  signIn,
  preview,
}: {
  startedAt: string | null;
  signIn?: React.ReactNode;
  /** Safe preview: shows the same screen with a close button and simulated controls. */
  preview?: { onClose: () => void };
}) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[80] grid grid-cols-[minmax(0,1fr)] place-items-center overflow-y-auto bg-background/95 p-4 backdrop-blur" role={preview ? "dialog" : "alertdialog"} aria-modal={preview ? true : undefined} aria-labelledby="dev-hold-title">
      <div className="card-elevated my-4 w-full min-w-0 max-w-3xl space-y-4 border-warning/50 p-4 sm:p-6">
        {preview && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-info/40 bg-info/10 p-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 font-semibold">
              <Eye className="size-4 shrink-0" />
              {t({ bn: "শুধু প্রিভিউ — কিছু চালু বা সেভ হচ্ছে না, CRM-এর তথ্য অপরিবর্তিত", en: "Preview only — nothing is turned on or saved; CRM data is unchanged" })}
            </span>
            <Button size="sm" variant="outline" onClick={preview.onClose} autoFocus>
              <X className="size-4" /> {t({ bn: "প্রিভিউ বন্ধ করুন", en: "Close preview" })}
            </Button>
          </div>
        )}
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
        <NoticeVideos />
        {signIn}
        {preview && <PreviewControls />}
      </div>
    </div>
  );
}

/** Simulated Architect controls for the preview; never calls the server. */
function PreviewControls() {
  const t = useT();
  const [active, setActive] = useState(true);
  const [note, setNote] = useState("");
  const startedAt = new Date().toISOString();
  const simulated = () => toast.info(t({ bn: "প্রিভিউ: কিছু সেভ হয়নি", en: "Preview: nothing was saved" }));
  return (
    <section className="space-y-2 rounded-lg border border-dashed border-border p-3" aria-labelledby="dev-hold-preview-controls">
      <h2 id="dev-hold-preview-controls" className="text-sm font-semibold">
        {t({ bn: "System Architect-এর নিয়ন্ত্রণ (প্রিভিউ)", en: "System Architect controls (preview)" })}
      </h2>
      <StatusLine active={active} startedAt={active ? startedAt : null} startedBy={active ? t({ bn: "প্রিভিউ", en: "Preview" }) : null} />
      {active ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            simulated();
            setActive(false);
            setNote("");
          }}
        >
          <label htmlFor="dev-hold-preview-note" className="text-xs text-muted-foreground">
            {t({ bn: "কী নিশ্চিত করছেন (অডিটের জন্য)", en: "What you are confirming (for the audit log)" })}
          </label>
          <Input id="dev-hold-preview-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={note.trim().length < 3}>
            <CheckCircle2 className="size-4" /> {t({ bn: "নিশ্চিত করুন ও CRM খুলুন", en: "Confirm & reopen CRM" })}
          </Button>
        </form>
      ) : (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            simulated();
            setActive(true);
          }}
        >
          {t({ bn: "নোটিশ চালু করুন", en: "Turn notice on" })}
        </Button>
      )}
    </section>
  );
}

/** Button that opens the notice screen in safe preview mode. */
export function DevelopmentHoldPreviewButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Eye className="size-4" /> {t({ bn: "নোটিশ স্ক্রিন প্রিভিউ", en: "Preview notice screen" })}
      </Button>
      {open && <DevelopmentHoldScreen startedAt={new Date().toISOString()} preview={{ onClose: () => setOpen(false) }} />}
    </>
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
      <DevelopmentHoldPreviewButton />
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
      <DevelopmentHoldPreviewButton />
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
