import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, Save, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
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
import { importMyLeads, parseLeadFile, type ParsedLeadRow } from "@/lib/lead-import.functions";
import { useT } from "@/lib/i18n";
import { readMyLeadCollection } from "@/lib/lead-collection.functions";

const ACCEPT = ".csv,.tsv,.txt,.json,.pdf,.docx,.xlsx,.pptx,image/*,text/csv,application/pdf";

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Import leads from whatever the agent has: a CSV, a Word/Excel sheet, a PDF,
 * or a photo of a written list. The file is read into rows the agent can fix
 * before saving, so nothing enters the CRM unchecked.
 */
export function LeadImportDialog() {
  const t = useT();
  const queryClient = useQueryClient();
  const parse = useServerFn(parseLeadFile);
  const save = useServerFn(importMyLeads);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedLeadRow[]>([]);
  const [requestKey, setRequestKey] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const read = useServerFn(readMyLeadCollection);
  const setup = useQuery({ queryKey: ["my-lead-collection", "import"], queryFn: () => read({ data: {} }), enabled: open, retry: false, staleTime: 30000 });

  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 8 * 1024 * 1024) throw new Error(t({ bn: "ফাইলটি ৮ মেগাবাইটের কম হতে হবে", en: "The file must be under 8 MB" }));
      const dataBase64 = toBase64(await file.arrayBuffer());
      return parse({
        data: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64,
        },
      });
    },
    onSuccess: (result) => {
      setRows(result.rows);
      setRequestKey(crypto.randomUUID()); setNotice(null);
      toast.success(
        `${result.rows.length}টি লিড পাওয়া গেছে${result.skipped ? ` · ${result.skipped}টি বাদ পড়েছে (নম্বর নেই বা একই নম্বর)` : ""}`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => save({ data: { rows, requestKey } }),
    onSuccess: (result) => {
      window.__lovableEvents?.track?.("project.lead_import_completed", {
        source: "file_review",
        rows_received: rows.length,
        rows_accepted: result.added,
        rows_rejected: (result.duplicate ?? 0) + result.failed.length,
      });
      toast.success(
        `${result.added}টি নতুন লিড যোগ হয়েছে${result.duplicate ? ` · ${result.duplicate}টি আগেই ছিল` : ""}`,
      );
      const removed = new Set([...result.acceptedIndices, ...result.duplicateIndices]);
      setRows(current => current.filter((_, index) => !removed.has(index)));
      setRequestKey(crypto.randomUUID());
      setNotice(result.failed.length ? t({ bn: "কিছু সারি জমা হয়নি। তথ্য ঠিক করে আবার জমা দিন।", en: "Some rows were not submitted. Correct the retained rows and retry." }) : t({ bn: `${result.added}টি জমা · ${result.duplicate}টি আগে ছিল`, en: `${result.added} submitted · ${result.duplicate} already existed` }));
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["my-lead-collection"] });
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const update = (index: number, patch: Partial<ParsedLeadRow>) =>
    { setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row))); setRequestKey(crypto.randomUUID()); };
  const busy = saveMutation.isPending || parseMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={next => { if (!saveMutation.isPending && !parseMutation.isPending) setOpen(next); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Upload className="size-4" /> {t({ bn: "ফাইল থেকে লিড", en: "Import file" })}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t({ bn: "ফাইল থেকে লিড ইমপোর্ট", en: "Import collected leads" })}</DialogTitle>
          <DialogDescription>
            {t({ bn: "যাচাই করা লিড · LeadHub বরাদ্দের অপেক্ষায়", en: "Reviewed leads · awaiting LeadHub assignment" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {setup.data?.ready === false && <p role="status" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">{t({ bn: "নিরাপদ সংরক্ষণ এখনো চালু হয়নি", en: "Secure saving is not activated yet" })}</p>}
          {setup.isError && <p role="alert" className="text-sm text-destructive">{t({ bn: "অ্যাকাউন্ট যাচাই করা যায়নি", en: "Account check unavailable" })}</p>}
          {notice && <p role="alert" className="text-sm text-foreground">{notice}</p>}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setFileName(file.name);
              setRows([]);
              parseMutation.mutate(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              className="gap-2"
              disabled={busy || setup.data?.ready !== true}
              onClick={() => fileInput.current?.click()}
            >
              {parseMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              {t({ bn: "ফাইল বাছুন", en: "Choose file" })}
            </Button>
            <p className="break-all text-xs text-muted-foreground">{fileName ?? t({ bn: "সর্বোচ্চ ৮ মেগাবাইট", en: "Up to 8 MB" })}</p>
          </div>

              {rows.length > 0 && (
            <div className="table-scroll rounded-md border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">ক্রমিক</th>
                    <th className="px-2 py-2 font-medium">নাম</th>
                    <th className="px-2 py-2 font-medium">ঠিকানা</th>
                    <th className="px-2 py-2 font-medium">ফোন</th>
                    <th className="px-2 py-2 font-medium">রেফারেন্স</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8 w-16"
                          disabled={busy}
                          aria-label={t({ bn: `সারি ${index + 1} ক্রমিক`, en: `Row ${index + 1} serial` })}
                          value={row.serialNo ?? ""}
                          onChange={(e) => update(index, { serialNo: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8"
                          disabled={busy}
                          aria-label={t({ bn: `সারি ${index + 1} নাম`, en: `Row ${index + 1} name` })}
                          value={row.name}
                          onChange={(e) => update(index, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8"
                          disabled={busy}
                          aria-label={t({ bn: `সারি ${index + 1} ঠিকানা`, en: `Row ${index + 1} address` })}
                          value={row.address ?? ""}
                          onChange={(e) => update(index, { address: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="tabular h-8 w-36"
                          disabled={busy}
                          aria-label={t({ bn: `সারি ${index + 1} ফোন`, en: `Row ${index + 1} phone` })}
                          value={row.phoneNumber}
                          onChange={(e) => update(index, { phoneNumber: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          className="h-8"
                          disabled={busy}
                          aria-label={t({ bn: `সারি ${index + 1} রেফারেন্স`, en: `Row ${index + 1} reference` })}
                          value={row.referenceBy ?? ""}
                          placeholder="নিজে / হেড অফিস"
                          onChange={(e) => update(index, { referenceBy: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={busy}
                          aria-label={t({ bn: `সারি ${index + 1} বাদ দিন`, en: `Remove row ${index + 1}` })}
                          onClick={() => { setRows((c) => c.filter((_, i) => i !== index)); setRequestKey(crypto.randomUUID()); }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && (
            <Label className="text-xs text-muted-foreground">
              {t({ bn: `${rows.length}টি যাচাই করা সারি · নতুন লিড LeadHub-এর অপেক্ষায় থাকবে`, en: `${rows.length} reviewed rows · new leads remain awaiting LeadHub` })}
            </Label>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={rows.length === 0 || saveMutation.isPending || setup.data?.ready !== true}
            onClick={() => saveMutation.mutate()}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t({ bn: `${rows.length}টি লিড জমা দিন`, en: `Submit ${rows.length} leads` })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
