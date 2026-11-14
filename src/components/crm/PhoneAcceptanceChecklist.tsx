import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleDashed, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listPhoneAcceptance } from "@/lib/phone-acceptance.functions";
import { REASON_LABEL, STEP_TITLE, type StepStatus } from "@/lib/phone-acceptance";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

const dhaka = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Done" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-label="Needs attention" />;
  return <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Waiting" />;
}

const HOW_TO = [
  { en: "Install the app on the phone from the IT Console download link above (check the SHA-256).", bn: "উপরের IT Console ডাউনলোড লিংক থেকে ফোনে অ্যাপ ইনস্টল করুন (SHA-256 মিলিয়ে নিন)।" },
  { en: "Open the app and sign in with the agent's own CRM account; allow Phone and Call log.", bn: "অ্যাপ খুলে এজেন্টের নিজের CRM অ্যাকাউন্টে সাইন-ইন করুন; Phone ও Call log অনুমতি দিন।" },
  { en: "From the app, call a second phone you control, let it be answered, talk 20+ seconds, hang up.", bn: "অ্যাপ থেকে নিজের আরেকটি ফোনে কল করুন, রিসিভ করে ২০+ সেকেন্ড কথা বলে কেটে দিন।" },
  { en: "Press Refresh. All three rows must show a tick. Use test numbers only, never a customer.", bn: "Refresh চাপুন। তিনটি সারিতেই টিক থাকতে হবে। শুধু টেস্ট নম্বর, কখনো গ্রাহক নয়।" },
];

/** IT Console: read-only real-phone acceptance per agent phone. */
export function PhoneAcceptanceChecklist() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(listPhoneAcceptance);
  const q = useQuery({
    queryKey: ["phone-acceptance", adminToken ? "pin" : "session"],
    queryFn: () => read({ data: { adminToken } }),
    retry: false,
    refetchInterval: 60_000,
  });
  const phones = q.data?.phones ?? [];
  const ready = phones.filter((p) => p.ready).length;

  return (
    <section className="space-y-4 border-b border-border pb-6" aria-label="Real phone test checklist">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t({ en: "Real phone test checklist", bn: "আসল ফোন টেস্ট চেকলিস্ট" })}</h2>
          <p className="text-sm text-muted-foreground">
            {t({ en: "Ticks come only from what the phone and CRM actually recorded. Nothing here changes leads or calls.", bn: "টিক আসে শুধু ফোন ও CRM-এ যা সত্যিই রেকর্ড হয়েছে তা থেকে। এখানে কোনো লিড বা কল বদলায় না।" })}
          </p>
        </div>
        <Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
          {t({ en: "Refresh", bn: "রিফ্রেশ" })}
        </Button>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {HOW_TO.map((s, i) => <li key={i}>{t(s)}</li>)}
      </ol>

      {q.data && !q.data.official && (
        <p className="rounded-md border border-border bg-muted p-3 text-sm">
          {t({ en: `The current download (${q.data.expectedVersion}) has not met the final-release evidence gates. This checklist does not establish source provenance, signing approval or complete handset acceptance.`, bn: `বর্তমান ডাউনলোডটির (${q.data.expectedVersion}) চূড়ান্ত রিলিজের প্রমাণ পূর্ণ নয়। এই চেকলিস্ট কোডের উৎস, স্বাক্ষরের অনুমোদন বা সম্পূর্ণ ফোন পরীক্ষা নিশ্চিত করে না।` })}
        </p>
      )}

      {q.isError && <p className="text-sm text-destructive">{t({ en: "Checklist unavailable. Unlock with the IT PIN and try again.", bn: "চেকলিস্ট পাওয়া যায়নি। IT PIN দিয়ে আবার চেষ্টা করুন।" })}</p>}
      {q.isLoading && <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>}

      {q.data && (
        <>
          <p className="text-sm">
            {t({ en: `${ready} of ${phones.length} phones passed all three checks · checked ${dhaka(q.data.checkedAt)} Dhaka`, bn: `${phones.length}টি ফোনের মধ্যে ${ready}টি তিনটি ধাপেই পাস · যাচাই ${dhaka(q.data.checkedAt)} ঢাকা` })}
          </p>
          {phones.length === 0 && (
            <p className="text-sm text-muted-foreground">{t({ en: "No agent has signed in on an Android phone yet.", bn: "এখনো কোনো এজেন্ট Android ফোনে সাইন-ইন করেননি।" })}</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {phones.map((p) => (
              <article key={p.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{p.agentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.label} · Android {p.androidVersion ?? "—"} · {t({ en: "app", bn: "অ্যাপ" })} {p.appVersion ?? "—"}
                    </p>
                  </div>
                  <Badge variant={p.ready ? "default" : "secondary"}>
                    {p.ready ? t({ en: "Passed", bn: "পাস" }) : t({ en: "Not yet", bn: "এখনো নয়" })}
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {p.steps.map((s) => (
                    <li key={s.key} className="flex items-start gap-2 text-sm">
                      <StepIcon status={s.status} />
                      <span>
                        <span className="font-medium">{t(STEP_TITLE[s.key])}</span>
                        <span className="block text-muted-foreground">{t(REASON_LABEL[s.reason])}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {t({ en: "Last seen", bn: "শেষ দেখা" })} {dhaka(p.lastSeenAt)} · {t({ en: "last call", bn: "শেষ কল" })} {dhaka(p.lastCallAt)}
                </p>
              </article>
            ))}
          </div>
          {q.data.noPhone.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t({ en: "Web only (no phone signed in):", bn: "শুধু ওয়েব (ফোনে সাইন-ইন নেই):" })} {q.data.noPhone.join(", ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
