import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileText, Loader2, Plus, Save, UserPlus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readMyLeadCollection, saveMyLeadDraft, submitMyCollectedLead } from "@/lib/lead-collection.functions";
import { collectionPhone, emptyLeadDraft, type CollectionDraft, type LeadDraftFields } from "@/lib/lead-collection";
import { useT } from "@/lib/i18n";

/** A collected lead is submitted, not self-assigned. Input remains in memory on failure. */
export function NewLeadDialog({ draft, disabled = false, onSaved, onViewReceipt }: {
  draft?: CollectionDraft | undefined; disabled?: boolean; onSaved?: (() => void) | undefined; onViewReceipt?: ((id: string) => void) | undefined;
}) {
  const t = useT();
  const id = useId();
  const queryClient = useQueryClient();
  const create = useServerFn(submitMyCollectedLead);
  const saveDraft = useServerFn(saveMyLeadDraft);
  const read = useServerFn(readMyLeadCollection);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<LeadDraftFields>(draft?.fields ?? emptyLeadDraft());
  const [draftRef, setDraftRef] = useState<{ id: string; revision: number } | null>(draft ? { id: draft.id, revision: draft.revision } : null);
  const [requestKey, setRequestKey] = useState("");
  const [more, setMore] = useState(Boolean(draft));
  const [receipt, setReceipt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ready = useQuery({ queryKey: ["my-lead-collection", "entry"], queryFn: () => read({ data: {} }), enabled: open, retry: false, staleTime: 30000 });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-lead-collection"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
    onSaved?.();
  };
  const mutation = useMutation({
    mutationFn: (another: boolean) => create({ data: { requestKey: requestKey || crypto.randomUUID(), fields, draftId: draftRef?.id ?? null, revision: draftRef?.revision ?? null } }).then(result => ({ result, another })),
    onSuccess: ({ result, another }) => {
      const row = result.results[0];
      if (row?.status !== "accepted" || !row.receiptId) {
        setNotice(t({ bn: "নম্বরটি আগে থেকেই আছে। নতুন লিড তৈরি হয়নি, বরাদ্দও বদলায়নি।", en: "This number already exists. No new lead was created or reassigned." }));
        return;
      }
      toast.success(t({ bn: "জমা হয়েছে — LeadHub বরাদ্দের অপেক্ষায়", en: "Submitted — awaiting LeadHub assignment" }));
      window.__lovableEvents?.track?.("project.lead_submitted", { from_draft: Boolean(draftRef), another });
      setReceipt(row.receiptId); setFields(emptyLeadDraft()); setDraftRef(null); setRequestKey(crypto.randomUUID()); setNotice(null); startedRef.current = false;
      refresh();
      if (another) setReceipt(null);
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const draftMutation = useMutation({
    mutationFn: (reference: { id: string; revision: number }) => saveDraft({ data: { ...reference, fields } }),
    onSuccess: saved => { window.__lovableEvents?.track?.("project.lead_draft_saved", { revision: saved.revision }); setDraftRef({ id: saved.id, revision: saved.revision }); setNotice(null); toast.success(t({ bn: "খসড়া সংরক্ষিত", en: "Draft saved" })); refresh(); },
    onError: (error: Error) => setNotice(error.message),
  });
  const busy = mutation.isPending || draftMutation.isPending;
  const available = ready.data?.ready === true;
  const valid = fields.name.trim().length > 0 && collectionPhone(fields.phoneNumber) !== null;
  const startedRef = useRef(false);
  const update = (key: keyof LeadDraftFields, value: string) => { if (!startedRef.current) { startedRef.current = true; window.__lovableEvents?.track?.("project.lead_form_started", { resumed_draft: Boolean(draftRef) }); } setFields(prev => ({ ...prev, [key]: value })); setRequestKey(crypto.randomUUID()); setNotice(null); };
  const textInput = (key: keyof LeadDraftFields, label: string, type = "text") => <div className="space-y-1.5"><Label htmlFor={`${id}-${key}`}>{label}</Label><Input id={`${id}-${key}`} type={type} inputMode={key === "phoneNumber" ? "tel" : "text"} value={fields[key]} onChange={e => update(key, e.target.value)} disabled={busy} maxLength={key === "address" ? 300 : key === "phoneNumber" || key === "serialNo" ? 40 : 120} /></div>;
  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) { setOpen(next); if (next && !requestKey) setRequestKey(crypto.randomUUID()); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" disabled={disabled} variant={draft ? "outline" : "default"}>
          {draft ? <FileText className="size-4" /> : <UserPlus className="size-4" />} {draft ? t({ bn: "খসড়া চালিয়ে যান", en: "Continue draft" }) : t({ bn: "লিড যোগ করুন", en: "Add lead" })}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t({ bn: "নিজের সংগ্রহ করা লিড", en: "My collected lead" })}</DialogTitle>
          <DialogDescription>{t({ bn: "LeadHub বরাদ্দের অপেক্ষায়", en: "Awaiting LeadHub assignment" })}</DialogDescription>
        </DialogHeader>
        {ready.isPending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t({ bn: "যাচাই হচ্ছে", en: "Checking" })}</p>}
        {ready.data?.ready === false && <p role="status" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{t({ bn: "নিরাপদ সংরক্ষণ এখনো চালু হয়নি। কোনো তথ্য জমা হয়নি।", en: "Secure saving is not activated yet. No entry has been submitted." })}</p>}
        {ready.isError && <p role="alert" className="text-sm text-destructive">{t({ bn: "অ্যাকাউন্ট যাচাই করা যায়নি", en: "Account check unavailable" })}</p>}
        {receipt ? <div className="space-y-3 py-3"><Check className="size-6 text-live" /><p className="font-medium">{t({ bn: "জমা হয়েছে", en: "Submitted" })} · LC-{receipt.slice(0,8).toUpperCase()}</p><div className="flex flex-wrap gap-2">{onViewReceipt && <Button variant="outline" onClick={() => { onViewReceipt(receipt); setOpen(false); }}>{t({ bn: "জমার রসিদ দেখুন", en: "View submission" })}</Button>}<Button onClick={() => setReceipt(null)}><Plus className="size-4" />{t({ bn: "আরেকটি যোগ করুন", en: "Add another" })}</Button></div></div> : <>
          <div className="space-y-4">
            {textInput("name", t({ bn: "ক্রেতার নাম", en: "Customer name" }))}
            {textInput("phoneNumber", t({ bn: "ফোন নম্বর", en: "Phone number" }), "tel")}
            {fields.phoneNumber && !collectionPhone(fields.phoneNumber) && <p className="text-xs text-destructive">{t({ bn: "সঠিক নম্বর দিন; বিদেশি নম্বরে +দেশের কোড দিন", en: "Enter a valid number; include +country code for international numbers" })}</p>}
            <Button size="sm" variant="ghost" onClick={() => setMore(v => !v)} aria-expanded={more} disabled={busy}><Plus className="size-4" />{t({ bn: "আরও তথ্য (ঐচ্ছিক)", en: "More details (optional)" })}</Button>
            {more && <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              {textInput("address", t({ bn: "ঠিকানা", en: "Address" }))}{textInput("company", t({ bn: "প্রতিষ্ঠান", en: "Organisation" }))}
              {textInput("referenceBy", t({ bn: "রেফারেন্স", en: "Reference" }))}{textInput("serialNo", t({ bn: "ক্রমিক নম্বর", en: "Serial number" }))}
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`${id}-notes`}>{t({ bn: "নোট", en: "Notes" })}</Label><Textarea id={`${id}-notes`} value={fields.notes} onChange={e => update("notes", e.target.value)} rows={3} maxLength={2000} disabled={busy} /></div>
            </div>}
          </div>
          {notice && <p role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">{notice}</p>}
          <DialogFooter className="flex-wrap gap-2 sm:justify-start">
            <Button variant="outline" disabled={!available || busy} onClick={() => { const reference = draftRef ?? { id: crypto.randomUUID(), revision: 0 }; setDraftRef(reference); draftMutation.mutate(reference); }}><Save className="size-4" />{t({ bn: "খসড়া রাখুন", en: "Save draft" })}</Button>
            <Button disabled={!available || !valid || busy} onClick={() => mutation.mutate(false)}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{t({ bn: "জমা দিন", en: "Submit" })}</Button>
            <Button variant="secondary" disabled={!available || !valid || busy} onClick={() => mutation.mutate(true)}><Plus className="size-4" />{t({ bn: "জমা দিয়ে আরেকটি", en: "Submit & add another" })}</Button>
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  );
}
