import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccount, signInWithIdentifier } from "@/lib/accounts.functions";

export const Route = createFileRoute("/it-access")({
  ssr: false,
  head: () => ({ meta: [
    { title: "IT access — Winstone Pulse" },
    { name: "description", content: "IT PIN verification and operator sign-in for Winstone Pulse." },
    { property: "og:title", content: "IT access — Winstone Pulse" },
    { property: "og:description", content: "Restricted operator and System Architect access." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: ItAccess,
});

function ItAccess() {
  const navigate = useNavigate();
  const [pinOpen, setPinOpen] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: async () => {
      const tokens = await signInWithIdentifier({ data: { identifier: email.trim(), password } });
      setPassword("");
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw new Error(error.message);
      // Never pass the PIN token here: it would mask the actual account permissions.
      const account = await getMyAccount({ data: { adminToken: null } });
      if (account.scope !== "authority" || account.readOnly || account.profile?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("এই অ্যাকাউন্টের IT Operator অনুমতি নেই।");
      }
    },
    onSuccess: () => { toast.success("IT Operator signed in"); void navigate({ to: "/system" }); },
    onError: (error: Error) => { setPassword(""); toast.error(error.message); },
  });
  return <main className="mx-auto min-h-dvh max-w-md space-y-6 px-4 py-8 sm:py-12">
    {pinVerified ? <Button variant="ghost" size="sm" disabled={login.isPending} onClick={() => { setPinVerified(false); setPassword(""); login.reset(); }}><ArrowLeft className="size-4" />আগের ধাপে ফিরে যান</Button> : <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" />হোমে ফিরে যান</Link></Button>}
    <header className="flex items-center gap-3 border-b border-border pb-4">
      <ShieldCheck className="size-6 text-primary" />
      <h1 className="text-xl font-semibold">IT Console access</h1>
    </header>
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4" />১. IT Console PIN</h2>
      <Button variant={pinVerified ? "outline" : "default"} onClick={() => setPinOpen(true)}>{pinVerified ? "PIN যাচাই হয়েছে" : "PIN দিয়ে আনলক"}</Button>
    </section>
    {pinVerified && <section className="space-y-4 border-t border-border pt-5">
      <h2 className="text-base font-semibold">২. IT Operator লগইন</h2>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!login.isPending) login.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="it-email">Email</Label><Input id="it-email" type="email" autoComplete="username" autoCapitalize="none" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="it-password">Password</Label><Input id="it-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={login.isPending || !email.trim() || !password}>{login.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}IT Operator হিসেবে লগইন</Button>
        {login.error && <p role="alert" className="text-sm text-destructive">{login.error.message}</p>}
      </form>
      <div className="space-y-3 border-t border-border pt-5">
        <h2 className="text-base font-semibold">System Architect</h2>
        <Button asChild variant="outline" className="w-full"><Link to="/tech"><ShieldCheck className="size-4" />Architect হিসেবে প্রবেশ</Link></Button>
      </div>
    </section>}
    <AdminPinDialog open={pinOpen} onOpenChange={setPinOpen} surface="system" onUnlocked={() => setPinVerified(true)} />
  </main>;
}