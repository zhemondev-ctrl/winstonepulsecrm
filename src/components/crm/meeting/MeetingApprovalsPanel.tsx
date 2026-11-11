import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, ClipboardCheck, Copy, Eye, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import {
  canFinalize,
  decisionCounts,
  decisionNeedsComment,
  meetingApprovalPath,
  MAX_MEETING_ITEMS,
  type MeetingDecision,
  type MeetingItemDecision,
  type MeetingStatus,
} from "@/lib/meeting-approvals";
import {
  createMeetingApproval,
  decideMeetingItem,
  finalizeMeetingApproval,
  getMeetingApproval,
  listMeetingApprovals,
  logMeetingLinkShared,
  withdrawMeetingApproval,
} from "@/lib/meeting-approvals.functions";

type Surface = "it" | "hq";
type T = ReturnType<typeof useT>;

const STATUS: Record<MeetingStatus, { en: string; bn: string; tone: string }> = {
  awaiting: { en: "Awaiting HQ decision", bn: "HQ সিদ্ধান্তের অপেক্ষায়", tone: "border-warning/50 bg-warning/15 text-foreground" },
  decided: { en: "Decided", bn: "সিদ্ধান্ত হয়েছে", tone: "border-success/40 bg-success/15 text-foreground" },
  withdrawn: { en: "Withdrawn", bn: "প্রত্যাহার করা", tone: "border-border bg-muted text-muted-foreground" },
};

const DECISION: Record<MeetingItemDecision, { en: string; bn: string; tone: string }> = {
  pending: { en: "Not decided", bn: "সিদ্ধান্ত বাকি", tone: "border-border bg-muted text-muted-foreground" },
  approved: { en: "Approved", bn: "অনুমোদিত", tone: "border-success/40 bg-success/15 text-foreground" },
  approved_with_changes: { en: "Approved with changes", bn: "পরিবর্তনসহ অনুমোদিত", tone: "border-warning/50 bg-warning/15 text-foreground" },
  rejected: { en: "Rejected", bn: "বাতিল", tone: "border-destructive/40 bg-destructive/10 text-destructive" },
};

const EVENT: Record<string, { en: string; bn: string }> = {
  created: { en: "Request created", bn: "অনুরোধ তৈরি" },
  link_shared: { en: "Link shared", bn: "লিংক পাঠানো হয়েছে" },
  opened: { en: "First opened by HQ", bn: "HQ প্রথম খুলেছে" },
  item_decided: { en: "Item decided", bn: "বিষয়ে সিদ্ধান্ত" },
  finalized: { en: "Final decision submitted", bn: "চূড়ান্ত সিদ্ধান্ত জমা" },
  withdrawn: { en: "Withdrawn by IT", bn: "IT প্রত্যাহার করেছে" },
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{children}</span>;
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Could not save";
}

/** IT creates & shares; Executive HQ decides per item; both read the permanent history. */
export function MeetingApprovalsPanel({ surface }: { surface: Surface }) {
  const t = useT();
  const selected = useRouterState({
    select: (s) => {
      const v = (s.location.search as Record<string, unknown>)["approval"];
      return typeof v === "string" ? v : null;
    },
  });
  const navigate = useNavigate();
  const route = surface === "hq" ? "/hq" : "/system";
  const open = (id: string | null) =>
    void navigate({ to: route, search: id ? { s: "approvals", approval: id } : { s: "approvals" } } as never);

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t({ en: "Meeting approvals", bn: "মিটিং অনুমোদন" })}</h2>
          <p className="text-sm text-muted-foreground">
            {surface === "it"
              ? t({ en: "Write the meeting summary and the items that need a decision, then send the link to Executive HQ on WhatsApp.", bn: "মিটিংয়ের সারসংক্ষেপ ও সিদ্ধান্তের বিষয়গুলো লিখুন, তারপর লিংকটি হোয়াটসঅ্যাপে এক্সিকিউটিভ HQ-কে পাঠান।" })
              : t({ en: "Review each item from the meeting and approve, approve with changes, or reject. Approval records the decision only — it does not change CRM rules by itself.", bn: "মিটিংয়ের প্রতিটি বিষয় দেখে অনুমোদন, পরিবর্তনসহ অনুমোদন বা বাতিল করুন। অনুমোদন শুধু সিদ্ধান্ত সংরক্ষণ করে — নিজে থেকে CRM-এর নিয়ম বদলায় না।" })}
          </p>
        </div>
      </div>
      {selected ? <Detail id={selected} surface={surface} onBack={() => open(null)} /> : <List surface={surface} onOpen={open} />}
    </section>
  );
}

function List({ surface, onOpen }: { surface: Surface; onOpen: (id: string) => void }) {
  const t = useT();
  const adminToken = useAdminToken();
  const list = useServerFn(listMeetingApprovals);
  const [creating, setCreating] = useState(false);
  const q = useQuery({
    queryKey: ["meeting-approvals", adminToken],
    queryFn: () => list({ data: { adminToken } }),
    enabled: Boolean(adminToken),
  });

  if (!adminToken) return <p className="text-sm text-muted-foreground">{t({ en: "Unlock with your PIN to see meeting approvals.", bn: "মিটিং অনুমোদন দেখতে পিন দিয়ে খুলুন।" })}</p>;
  if (q.isError) return <p className="text-sm text-destructive">{errMsg(q.error)}</p>;
  if (q.isPending) return <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>;

  const rows = q.data.requests;
  return (
    <div className="space-y-4">
      {q.data.canCreate && (
        creating ? (
          <CreateForm onDone={(id) => { setCreating(false); if (id) onOpen(id); }} />
        ) : (
          <Button onClick={() => setCreating(true)} className="w-full sm:w-auto"><Plus className="mr-2 size-4" />{t({ en: "New approval request", bn: "নতুন অনুমোদন অনুরোধ" })}</Button>
        )
      )}
      {surface === "hq" && !q.data.canDecide && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{t({ en: "View only. Decisions need the Executive HQ PIN.", bn: "শুধু দেখা যাবে। সিদ্ধান্ত দিতে এক্সিকিউটিভ HQ পিন লাগবে।" })}</p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t({ en: "No meeting approvals yet.", bn: "এখনো কোনো মিটিং অনুমোদন নেই।" })}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const st = STATUS[r.status as MeetingStatus] ?? STATUS.awaiting;
            return (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="w-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-accent">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t({ en: "Meeting", bn: "মিটিং" })} {fmtDate(r.meeting_date)} · {r.decided}/{r.total} {t({ en: "decided", bn: "সিদ্ধান্ত" })}
                        {r.first_opened_at ? ` · ${t({ en: "seen by HQ", bn: "HQ দেখেছে" })}` : ""}
                      </p>
                    </div>
                    <Pill tone={st.tone}>{t(st)}</Pill>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CreateForm({ onDone }: { onDone: (id: string | null) => void }) {
  const t = useT();
  const adminToken = useAdminToken();
  const create = useServerFn(createMeetingApproval);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()));
  const [attendees, setAttendees] = useState("");
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState([{ title: "", detail: "" }]);

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          adminToken,
          title,
          meetingDate,
          attendees: attendees || undefined,
          summary,
          items: items.filter((i) => i.title.trim()).map((i) => ({ title: i.title, detail: i.detail || undefined })),
        },
      }),
    onSuccess: (r) => {
      toast.success(t({ en: "Approval request created — now share the link", bn: "অনুরোধ তৈরি হয়েছে — এখন লিংক পাঠান" }));
      qc.invalidateQueries({ queryKey: ["meeting-approvals"] });
      onDone(r.id);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const ready = title.trim().length >= 3 && summary.trim() && items.some((i) => i.title.trim().length >= 2);
  const setItem = (idx: number, patch: Partial<{ title: string; detail: string }>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-background p-4"
      onSubmit={(e) => { e.preventDefault(); if (ready) m.mutate(); }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">{t({ en: "Meeting title", bn: "মিটিংয়ের শিরোনাম" })}</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t({ en: "Meeting date", bn: "মিটিংয়ের তারিখ" })}</span>
          <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t({ en: "Attendees (optional)", bn: "উপস্থিত (ঐচ্ছিক)" })}</span>
          <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} maxLength={1000} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">{t({ en: "Meeting summary", bn: "মিটিংয়ের সারসংক্ষেপ" })}</span>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} maxLength={10000} required />
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">{t({ en: "Items that need a decision", bn: "যেসব বিষয়ে সিদ্ধান্ত লাগবে" })}</p>
        {items.map((it, idx) => (
          <div key={idx} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">{idx + 1}.</span>
              <Input value={it.title} onChange={(e) => setItem(idx, { title: e.target.value })} placeholder={t({ en: "What needs approval", bn: "কী অনুমোদন দরকার" })} maxLength={300} />
              {items.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label={t({ en: "Remove item", bn: "বিষয় সরান" })} onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            <Textarea value={it.detail} onChange={(e) => setItem(idx, { detail: e.target.value })} rows={2} placeholder={t({ en: "Details (optional)", bn: "বিস্তারিত (ঐচ্ছিক)" })} maxLength={3000} />
          </div>
        ))}
        {items.length < MAX_MEETING_ITEMS && (
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, { title: "", detail: "" }])}>
            <Plus className="mr-1 size-4" />{t({ en: "Add item", bn: "বিষয় যোগ করুন" })}
          </Button>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => onDone(null)}>{t({ en: "Cancel", bn: "বাতিল" })}</Button>
        <Button type="submit" disabled={!ready || m.isPending}>{m.isPending ? t({ en: "Saving…", bn: "সংরক্ষণ হচ্ছে…" }) : t({ en: "Create request", bn: "অনুরোধ তৈরি করুন" })}</Button>
      </div>
    </form>
  );
}

function Detail({ id, surface, onBack }: { id: string; surface: Surface; onBack: () => void }) {
  const t = useT();
  const adminToken = useAdminToken();
  const get = useServerFn(getMeetingApproval);
  const q = useQuery({
    queryKey: ["meeting-approval", id, adminToken],
    queryFn: () => get({ data: { adminToken, id } }),
    enabled: Boolean(adminToken),
  });

  const back = (
    <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 size-4" />{t({ en: "All approvals", bn: "সব অনুমোদন" })}</Button>
  );
  if (!adminToken) return <div className="space-y-2">{back}<p className="text-sm text-muted-foreground">{t({ en: "Unlock with your PIN to open this approval.", bn: "এই অনুমোদন খুলতে পিন দিন।" })}</p></div>;
  if (q.isError) return <div className="space-y-2">{back}<p className="text-sm text-destructive">{errMsg(q.error)}</p></div>;
  if (q.isPending) return <div className="space-y-2">{back}<p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p></div>;

  const { request, items, events, canDecide, canManage } = q.data;
  const st = STATUS[request.status as MeetingStatus] ?? STATUS.awaiting;
  const counts = decisionCounts(items as { decision: MeetingItemDecision }[]);

  return (
    <div className="space-y-5">
      {back}
      <div className="space-y-2 rounded-xl border border-border bg-background p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="text-lg font-semibold break-words">{request.title}</h3>
          <Pill tone={st.tone}>{t(st)}</Pill>
        </div>
        <p className="text-xs text-muted-foreground">
          {t({ en: "Meeting", bn: "মিটিং" })} {fmtDate(request.meeting_date)} · {t({ en: "Created", bn: "তৈরি" })} {fmt(request.created_at)}
          {request.attendees ? ` · ${request.attendees}` : ""}
        </p>
        <p className="whitespace-pre-wrap text-sm">{request.summary}</p>
        <p className="text-xs text-muted-foreground">
          {t({ en: "Approved", bn: "অনুমোদিত" })} {counts.approved} · {t({ en: "With changes", bn: "পরিবর্তনসহ" })} {counts.approved_with_changes} · {t({ en: "Rejected", bn: "বাতিল" })} {counts.rejected} · {t({ en: "Pending", bn: "বাকি" })} {counts.pending}
        </p>
        {request.status === "decided" && (
          <p className="text-sm font-medium">{t({ en: "Final decision by", bn: "চূড়ান্ত সিদ্ধান্ত দিয়েছেন" })} {request.final_signer} · {fmt(request.finalized_at)}{request.final_note ? ` — ${request.final_note}` : ""}</p>
        )}
        {request.status === "withdrawn" && (
          <p className="text-sm text-muted-foreground">{t({ en: "Withdrawn", bn: "প্রত্যাহার" })} {fmt(request.withdrawn_at)} — {request.withdrawn_reason}</p>
        )}
      </div>

      {canManage && request.status === "awaiting" && <ShareBox id={request.id} />}
      {surface === "hq" && !canDecide && request.status === "awaiting" && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{t({ en: "View only. Decisions need the Executive HQ PIN.", bn: "শুধু দেখা যাবে। সিদ্ধান্ত দিতে এক্সিকিউটিভ HQ পিন লাগবে।" })}</p>
      )}

      <ol className="space-y-3">
        {items.map((it) => (
          <ItemCard key={it.id} item={it} canDecide={canDecide} requestId={request.id} />
        ))}
      </ol>

      {canDecide && <FinalizeBox id={request.id} ready={canFinalize(items as { decision: MeetingItemDecision }[])} />}
      {canManage && request.status === "awaiting" && <WithdrawBox id={request.id} />}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">{t({ en: "History log", bn: "ইতিহাস" })}</h4>
        <ul className="space-y-1.5 rounded-xl border border-border bg-background p-3 text-sm">
          {events.map((e) => {
            const item = e.item_id ? items.find((i) => i.id === e.item_id) : null;
            const det = (e.details ?? {}) as Record<string, unknown>;
            const to = typeof det["to"] === "string" ? DECISION[det["to"] as MeetingItemDecision] : null;
            const via = det["via"] === "whatsapp" ? "WhatsApp" : det["via"] === "copy" ? t({ en: "copied", bn: "কপি" }) : null;
            return (
              <li key={e.id} className="flex flex-col gap-0.5 border-b border-border pb-1.5 last:border-0 last:pb-0 sm:flex-row sm:gap-3">
                <span className="shrink-0 text-xs tabular text-muted-foreground sm:w-40">{fmt(e.created_at)}</span>
                <span className="min-w-0 break-words">
                  <span className="font-medium">{t(EVENT[e.action] ?? { en: e.action, bn: e.action })}</span>
                  {item ? ` · #${item.position}` : ""}
                  {to ? ` → ${t(to)}` : ""}
                  {via ? ` (${via})` : ""}
                  {" · "}<span className="text-muted-foreground">{e.actor}</span>
                  {e.note ? <span className="block text-xs text-muted-foreground">{e.note}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ShareBox({ id }: { id: string }) {
  const t = useT();
  const adminToken = useAdminToken();
  const log = useServerFn(logMeetingLinkShared);
  const qc = useQueryClient();
  const url = typeof window === "undefined" ? meetingApprovalPath(id) : `${window.location.origin}${meetingApprovalPath(id)}`;
  const record = (via: "copy" | "whatsapp") =>
    log({ data: { adminToken, id, via } }).then(() => qc.invalidateQueries({ queryKey: ["meeting-approval", id] })).catch(() => undefined);
  const message = `${t({ en: "Meeting approval needed — please review and decide:", bn: "মিটিং অনুমোদন প্রয়োজন — দেখে সিদ্ধান্ত দিন:" })} ${url}`;

  return (
    <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <p className="text-sm font-semibold">{t({ en: "Send this link to Executive HQ", bn: "এই লিংকটি এক্সিকিউটিভ HQ-কে পাঠান" })}</p>
      <p className="text-xs text-muted-foreground">{t({ en: "They open it, unlock with the HQ PIN, and decide each item. You send it yourself — the CRM does not message anyone.", bn: "তারা লিংক খুলে HQ পিন দিয়ে প্রতিটি বিষয়ে সিদ্ধান্ত দেবেন। লিংক আপনি নিজে পাঠাবেন — CRM কাউকে মেসেজ করে না।" })}</p>
      <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={async () => {
            try { await navigator.clipboard.writeText(url); toast.success(t({ en: "Link copied", bn: "লিংক কপি হয়েছে" })); void record("copy"); }
            catch { toast.error(t({ en: "Copy failed — select the link and copy it", bn: "কপি হয়নি — লিংকটি সিলেক্ট করে কপি করুন" })); }
          }}
        >
          <Copy className="mr-2 size-4" />{t({ en: "Copy link", bn: "লিংক কপি" })}
        </Button>
        <Button asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={() => void record("whatsapp")}>
            <MessageCircle className="mr-2 size-4" />{t({ en: "Share on WhatsApp", bn: "হোয়াটসঅ্যাপে পাঠান" })}
          </a>
        </Button>
      </div>
    </div>
  );
}

type Item = { id: string; position: number; title: string; detail: string | null; decision: string; decision_comment: string | null; decided_at: string | null; decided_by: string | null };

function ItemCard({ item, canDecide, requestId }: { item: Item; canDecide: boolean; requestId: string }) {
  const t = useT();
  const adminToken = useAdminToken();
  const decide = useServerFn(decideMeetingItem);
  const qc = useQueryClient();
  const [comment, setComment] = useState(item.decision_comment ?? "");
  const d = DECISION[item.decision as MeetingItemDecision] ?? DECISION.pending;

  const m = useMutation({
    mutationFn: (decision: MeetingDecision) => decide({ data: { adminToken, itemId: item.id, decision, comment: comment.trim() || undefined } }),
    onSuccess: () => {
      toast.success(t({ en: "Decision saved", bn: "সিদ্ধান্ত সংরক্ষিত" }));
      qc.invalidateQueries({ queryKey: ["meeting-approval", requestId] });
      qc.invalidateQueries({ queryKey: ["meeting-approvals"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pick = (decision: MeetingDecision) => {
    if (decisionNeedsComment(decision) && !comment.trim()) {
      toast.error(t({ en: "Write a comment for changes or rejection", bn: "পরিবর্তন বা বাতিলের কারণ লিখুন" }));
      return;
    }
    m.mutate(decision);
  };

  return (
    <li className="space-y-2 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="font-semibold break-words">{item.position}. {item.title}</p>
        <Pill tone={d.tone}>{t(d)}</Pill>
      </div>
      {item.detail && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.detail}</p>}
      {item.decision !== "pending" && (
        <p className="text-xs text-muted-foreground">{item.decided_by} · {fmt(item.decided_at)}{item.decision_comment ? ` — ${item.decision_comment}` : ""}</p>
      )}
      {canDecide && (
        <div className="space-y-2 border-t border-border pt-3">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={2000} placeholder={t({ en: "Comment (needed for changes or rejection)", bn: "মন্তব্য (পরিবর্তন বা বাতিলে বাধ্যতামূলক)" })} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Button size="sm" disabled={m.isPending} onClick={() => pick("approved")}><Check className="mr-1 size-4" />{t({ en: "Approve", bn: "অনুমোদন" })}</Button>
            <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => pick("approved_with_changes")}>{t({ en: "Approve with changes", bn: "পরিবর্তনসহ অনুমোদন" })}</Button>
            <Button size="sm" variant="outline" className="text-destructive" disabled={m.isPending} onClick={() => pick("rejected")}>{t({ en: "Reject", bn: "বাতিল" })}</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function FinalizeBox({ id, ready }: { id: string; ready: boolean }) {
  const t = useT();
  const adminToken = useAdminToken();
  const finalize = useServerFn(finalizeMeetingApproval);
  const qc = useQueryClient();
  const [signer, setSigner] = useState("");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => finalize({ data: { adminToken, id, signer, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success(t({ en: "Final decision submitted — IT can now see it", bn: "চূড়ান্ত সিদ্ধান্ত জমা হয়েছে — IT এখন দেখতে পাবে" }));
      qc.invalidateQueries({ queryKey: ["meeting-approval", id] });
      qc.invalidateQueries({ queryKey: ["meeting-approvals"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-4">
      <p className="text-sm font-semibold">{t({ en: "Submit final decision", bn: "চূড়ান্ত সিদ্ধান্ত জমা দিন" })}</p>
      <p className="text-xs text-muted-foreground">{ready ? t({ en: "After submitting, decisions are locked and kept in the history log.", bn: "জমা দেওয়ার পর সিদ্ধান্ত লক হবে এবং ইতিহাসে থাকবে।" }) : t({ en: "Decide every item first.", bn: "আগে প্রতিটি বিষয়ে সিদ্ধান্ত দিন।" })}</p>
      <Input value={signer} onChange={(e) => setSigner(e.target.value)} maxLength={120} placeholder={t({ en: "Your name and title, e.g. Managing Director", bn: "আপনার নাম ও পদ, যেমন ম্যানেজিং ডিরেক্টর" })} />
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder={t({ en: "Overall note (optional)", bn: "সামগ্রিক মন্তব্য (ঐচ্ছিক)" })} />
      <Button className="w-full sm:w-auto" disabled={!ready || signer.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
        <Eye className="mr-2 size-4" />{m.isPending ? t({ en: "Submitting…", bn: "জমা হচ্ছে…" }) : t({ en: "Submit final decision", bn: "চূড়ান্ত সিদ্ধান্ত জমা" })}
      </Button>
    </div>
  );
}

function WithdrawBox({ id }: { id: string }) {
  const t = useT();
  const adminToken = useAdminToken();
  const withdraw = useServerFn(withdrawMeetingApproval);
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [openBox, setOpenBox] = useState(false);
  const m = useMutation({
    mutationFn: () => withdraw({ data: { adminToken, id, reason } }),
    onSuccess: () => {
      toast.success(t({ en: "Request withdrawn", bn: "অনুরোধ প্রত্যাহার হয়েছে" }));
      qc.invalidateQueries({ queryKey: ["meeting-approval", id] });
      qc.invalidateQueries({ queryKey: ["meeting-approvals"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!openBox) return <Button variant="ghost" size="sm" onClick={() => setOpenBox(true)}>{t({ en: "Withdraw this request", bn: "এই অনুরোধ প্রত্যাহার" })}</Button>;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-4">
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} placeholder={t({ en: "Why is it withdrawn? (kept in history)", bn: "কেন প্রত্যাহার? (ইতিহাসে থাকবে)" })} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => setOpenBox(false)}>{t({ en: "Cancel", bn: "বাতিল" })}</Button>
        <Button variant="outline" className="text-destructive" disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>{t({ en: "Withdraw", bn: "প্রত্যাহার" })}</Button>
      </div>
    </div>
  );
}
