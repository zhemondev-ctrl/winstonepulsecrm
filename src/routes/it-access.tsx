import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccount } from "@/lib/accounts.functions";
import { visibleItStep } from "@/lib/access-navigation";
import { takeArchitectReturnFocus } from "@/lib/access-focus";
import { lovable } from "@/integrations/lovable/index";
import { verifyItOperator } from "@/lib/it-operator-login";

export const Route = createFileRoute("/it-access")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { step?: string } => typeof search["step"] === "string" ? { step: search["step"] } : {},
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
  const router = useRouter();
  const { step: requestedStep } = Route.useSearch();
  const [pinVerified, setPinVerified] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const unlocking = useRef(false);
  const pinTrigger = useRef<HTMLAnchorElement>(null);
  const googleButton = useRef<HTMLButtonElement>(null);
  const architectTrigger = useRef<HTMLAnchorElement>(null);
  const step = visibleItStep(requestedStep, pinVerified, false);
  useEffect(() => {
    if (step === "pin" || step === "password") return;
    const fromArchitect = takeArchitectReturnFocus();
    const frame = requestAnimationFrame(() => {
      const target = fromArchitect ? architectTrigger.current ?? pinTrigger.current : step === "operator" ? googleButton.current : pinTrigger.current;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);
  const returnTo = (fallback: "entry" | "operator") => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: "/it-access", search: fallback === "entry" ? {} : { step: fallback }, replace: true });
  };
  const finishGoogleLogin = async () => {
    await verifyItOperator(() => getMyAccount({ data: { adminToken: null } }), () => supabase.auth.signOut());
    toast.success("IT Operator signed in");
    await navigate({ to: "/system" });
  };
  useEffect(() => {
    if (!pinVerified || step !== "operator" || sessionStorage.getItem("it-google-return") !== "pending") return;
    sessionStorage.removeItem("it-google-return");
    setGooglePending(true);
    void finishGoogleLogin().catch((error: unknown) => {
      setGoogleError(error instanceof Error ? error.message : "Google লগইন সম্পন্ন হয়নি।");
    }).finally(() => setGooglePending(false));
  }, [pinVerified, step]);
  const continueWithGoogle = async () => {
    setGooglePending(true);
    setGoogleError(null);
    try {
      sessionStorage.setItem("it-google-return", "pending");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/it-access?step=pin`,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      sessionStorage.removeItem("it-google-return");
      await finishGoogleLogin();
    } catch (error) {
      sessionStorage.removeItem("it-google-return");
      setGoogleError(error instanceof Error ? error.message : "Google লগইন সম্পন্ন হয়নি।");
    } finally { setGooglePending(false); }
  };
  return <main className="mx-auto min-h-dvh max-w-md space-y-6 px-4 py-8 sm:py-12">
    {step === "operator" || step === "password" ? <Button variant="ghost" size="sm" disabled={googlePending} onClick={() => returnTo(step === "password" ? "operator" : "entry")}><ArrowLeft className="size-4" />আগের ধাপে ফিরে যান</Button> : <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" />হোমে ফিরে যান</Link></Button>}
    <header className="flex items-center gap-3 border-b border-border pb-4">
      <ShieldCheck className="size-6 text-primary" />
      <h1 className="text-xl font-semibold">IT Console access</h1>
    </header>
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="size-4" />১. IT Console PIN</h2>
      <Button asChild variant={step === "operator" || step === "password" ? "outline" : "default"}><Link ref={pinTrigger} to="/it-access" search={{ step: "pin" }}>{step === "operator" || step === "password" ? "PIN যাচাই হয়েছে" : "PIN দিয়ে আনলক"}</Link></Button>
    </section>
    {step === "operator" && <section className="space-y-4 border-t border-border pt-5">
      <h2 className="text-base font-semibold">২. IT Operator লগইন</h2>
      <Button ref={googleButton} type="button" variant="outline" className="google-sign-in w-full" disabled={googlePending} onClick={() => void continueWithGoogle()}>
        {googlePending ? <Loader2 className="size-[18px] animate-spin" /> : <img src="/google-sign-in-mark.svg" alt="" width={18} height={18} className="size-[18px] shrink-0" />}
        Google দিয়ে চালিয়ে যান
      </Button>
      {googleError && <p role="alert" className="text-sm text-destructive">{googleError}</p>}
      <div className="space-y-3 border-t border-border pt-5">
        <h2 className="text-base font-semibold">System Architect</h2>
        <Button asChild variant="outline" className="w-full"><Link ref={architectTrigger} to="/tech"><ShieldCheck className="size-4" />Architect হিসেবে প্রবেশ</Link></Button>
      </div>
    </section>}
    <AdminPinDialog open={step === "pin"} onCloseAutoFocus={(event) => { event.preventDefault(); (step === "operator" ? googleButton.current : pinTrigger.current)?.focus({ preventScroll: true }); }} onOpenChange={(open) => { if (!open) queueMicrotask(() => { if (!unlocking.current) returnTo("entry"); unlocking.current = false; }); }} surface="system" onUnlocked={() => { unlocking.current = true; setPinVerified(true); void navigate({ to: "/it-access", search: { step: "operator" }, replace: true }); }} />
  </main>;
}