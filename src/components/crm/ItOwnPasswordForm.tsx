import { useState } from "react";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { changeOwnPassword } from "@/lib/own-password-change";

export function ItOwnPasswordForm({ onBack }: { onBack: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return <section className="space-y-4 border-t border-border pt-5">
    <Button variant="ghost" size="sm" disabled={busy} onClick={onBack}><ArrowLeft className="size-4" />লগইনে ফিরে যান</Button>
    <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4" />নিজের CRM পাসওয়ার্ড পরিবর্তন</h2>
    {saved ? <p role="status" className="text-sm text-foreground">পাসওয়ার্ড পরিবর্তন হয়েছে। পরের লগইনে নতুন পাসওয়ার্ড ব্যবহার করুন।</p> : <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError("");
      try {
        await changeOwnPassword(supabase.auth, current, next, confirmation);
        setSaved(true);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "পাসওয়ার্ড পরিবর্তন হয়নি। আবার চেষ্টা করুন।");
      } finally {
        setCurrent(""); setNext(""); setConfirmation(""); setBusy(false);
      }
    }}>
      <div className="space-y-2"><Label htmlFor="it-current-pw">বর্তমান পাসওয়ার্ড</Label><Input id="it-current-pw" type="password" autoComplete="current-password" required disabled={busy} value={current} onChange={(event) => setCurrent(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="it-new-pw">নতুন পাসওয়ার্ড</Label><Input id="it-new-pw" type="password" autoComplete="new-password" minLength={8} required disabled={busy} value={next} onChange={(event) => setNext(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="it-confirm-pw">নতুন পাসওয়ার্ড আবার লিখুন</Label><Input id="it-confirm-pw" type="password" autoComplete="new-password" minLength={8} required disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}পাসওয়ার্ড পরিবর্তন করুন</Button>
    </form>}
  </section>;
}