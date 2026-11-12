import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canApproveOfficer, OFFICER_STATUS_LABEL } from "@/lib/it-onboarding";
import { approveItOfficer, inviteItOfficer, listItOfficerInvites } from "@/lib/it-onboarding.functions";
import { getAdminToken, useAdminToken } from "@/lib/local-session";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

/** IT Console: invite a new IT Operator; they set their own password from the email. */
export function ItOfficerOnboardingPanel() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const list = useServerFn(listItOfficerInvites);
  const invite = useServerFn(inviteItOfficer);
  const approve = useServerFn(approveItOfficer);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const invites = useQuery({
    queryKey: ["it-officer-invites"],
    queryFn: () => list({ data: { adminToken: adminToken ?? null } }),
    enabled: Boolean(adminToken),
    refetchInterval: 30_000,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["it-officer-invites"] });

  const send = useMutation({
    mutationFn: () => invite({ data: { adminToken: getAdminToken(), name: name.trim(), email: email.trim(), origin: window.location.origin } }),
    onSuccess: () => { toast.success("আমন্ত্রণ ইমেইল পাঠানো হয়েছে"); setName(""); setEmail(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const grant = useMutation({
    mutationFn: (id: string) => approve({ data: { adminToken: getAdminToken(), id } }),
    onSuccess: () => { toast.success("নতুন IT অপারেটর সক্রিয় হয়েছে"); refresh(); },
    onError: (e: Error) => { toast.error(e.message); refresh(); },
  });

  const canManage = invites.data?.canManage ?? false;
  const rows = invites.data?.invites ?? [];

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <UserPlus className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">নতুন IT অপারেটর <span className="font-normal text-muted-foreground">/ New IT Operator</span></h2>
      </header>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>নাম আর ইমেইল দিয়ে আমন্ত্রণ পাঠান।</li>
        <li>অপারেটর ইমেইলের লিংক খুলে নিজেই পাসওয়ার্ড সেট করবেন। পাসওয়ার্ড কেউ দেখতে পায় না।</li>
        <li>তারপর এখানে "অনুমোদন ও IT ক্ষমতা দিন" চাপুন।</li>
      </ol>

      {invites.isError && <p role="alert" className="text-sm text-destructive">{(invites.error as Error).message}</p>}
      {invites.data && !canManage && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-foreground">
          {invites.data.manageProblem} — আমন্ত্রণ পাঠাতে ও অনুমোদন দিতে IT access পাতা থেকে নিজের IT Operator অ্যাকাউন্টে লগইন করুন।
        </p>
      )}

      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => { e.preventDefault(); if (!send.isPending) send.mutate(); }}
      >
        <div className="space-y-1.5"><Label htmlFor="it-officer-name">নাম</Label><Input id="it-officer-name" value={name} maxLength={80} disabled={!canManage || send.isPending} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="it-officer-email">ইমেইল</Label><Input id="it-officer-email" type="email" autoCapitalize="none" value={email} maxLength={160} disabled={!canManage || send.isPending} onChange={(e) => setEmail(e.target.value)} /></div>
        <Button type="submit" disabled={!canManage || send.isPending || name.trim().length < 2 || !email.includes("@")}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}আমন্ত্রণ পাঠান
        </Button>
      </form>

      {invites.isPending && adminToken && <p className="text-sm text-muted-foreground">তালিকা আনা হচ্ছে…</p>}
      {rows.length === 0 && invites.data && <p className="text-sm text-muted-foreground">এখনো কোনো আমন্ত্রণ নেই।</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                <p className="mt-1 text-xs">
                  <span className={r.status === "active" ? "text-success" : r.status === "failed" ? "text-destructive" : "text-foreground"}>{OFFICER_STATUS_LABEL[r.status].bn}</span>
                  <span className="text-muted-foreground"> · আমন্ত্রণ {when(r.invitedAt)}{r.activeAt ? ` · সক্রিয় ${when(r.activeAt)}` : ""}</span>
                </p>
              </div>
              {canApproveOfficer(r.status) && (
                <Button size="sm" disabled={!canManage || grant.isPending} onClick={() => { if (window.confirm(`${r.name}-কে পূর্ণ IT অপারেটর ক্ষমতা দেবেন?`)) grant.mutate(r.id); }}>
                  {grant.isPending && grant.variables === r.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}অনুমোদন ও IT ক্ষমতা দিন
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
