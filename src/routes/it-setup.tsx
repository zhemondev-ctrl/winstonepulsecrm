import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { OFFICER_STATUS_LABEL, type OfficerStatus } from "@/lib/it-onboarding";
import { markMyItPasswordSet, myItOfficerSetup } from "@/lib/it-onboarding.functions";

export const Route = createFileRoute("/it-setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "IT অপারেটর পাসওয়ার্ড সেটআপ — Winstone Pulse" },
      { name: "description", content: "আমন্ত্রিত নতুন IT অপারেটর এখানে নিজের পাসওয়ার্ড সেট করেন।" },
      { property: "og:title", content: "IT অপারেটর পাসওয়ার্ড সেটআপ — Winstone Pulse" },
      { property: "og:description", content: "ইমেইলের লিংক থেকে নিজের IT Console পাসওয়ার্ড সেট করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ItSetupPage,
});

function ItSetupPage() {
  const mine = useServerFn(myItOfficerSetup);
  const markSet = useServerFn(markMyItPasswordSet);
  const [ready, setReady] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ name: string; status: OfficerStatus } | null | undefined>(undefined);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (!data.session) { setReady(false); return; }
      setReady(true);
      try { const s = await mine(); if (alive) setSetup(s); } catch { if (alive) setSetup(null); }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") void load(); });
    void load();
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [mine]);

  const save = async () => {
    setError("");
    if (pw.length < 8) { setError("কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন"); return; }
    if (pw !== pw2) { setError("দুটি পাসওয়ার্ড মেলেনি"); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: pw });
    setPw(""); setPw2("");
    if (updateError) { setBusy(false); setError("পাসওয়ার্ড সেভ হয়নি। লিংকটি আবার খুলে চেষ্টা করুন।"); return; }
    try { setSetup(await markSet()); } catch (e) { setError(e instanceof Error ? e.message : "আবার চেষ্টা করুন"); }
    setBusy(false);
  };

  const status = setup?.status;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">IT অপারেটর সেটআপ</h1>
        </div>
        {ready === null || (ready && setup === undefined) ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />লোড হচ্ছে…</p>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground">লিংকটি আর বৈধ নেই বা আগেই ব্যবহার হয়েছে। নতুন লিংকের জন্য IT-কে জানান।</p>
        ) : !setup ? (
          <p className="text-sm text-muted-foreground">এই অ্যাকাউন্টের জন্য কোনো IT অপারেটর আমন্ত্রণ নেই।</p>
        ) : status === "invited" ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!busy) void save(); }}>
            <p className="text-sm text-muted-foreground">স্বাগতম, {setup.name}। নিজের IT Console পাসওয়ার্ড দিন। এটি কেউ দেখতে পাবে না।</p>
            <div className="space-y-1.5"><Label htmlFor="it-setup-pw">নতুন পাসওয়ার্ড</Label><Input id="it-setup-pw" type="password" autoComplete="new-password" minLength={8} required disabled={busy} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="it-setup-pw2">আবার লিখুন</Label><Input id="it-setup-pw2" type="password" autoComplete="new-password" minLength={8} required disabled={busy} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}পাসওয়ার্ড সেভ করুন</Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p role="status" className="text-sm text-foreground">{status ? OFFICER_STATUS_LABEL[status].bn : ""}</p>
            {status === "active" ? (
              <Button asChild className="w-full"><Link to="/it-access">IT Console-এ লগইন করুন</Link></Button>
            ) : (
              <p className="text-sm text-muted-foreground">IT অনুমোদন দিলে IT access পাতা থেকে ইমেইল ও এই পাসওয়ার্ড দিয়ে লগইন করবেন।</p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
