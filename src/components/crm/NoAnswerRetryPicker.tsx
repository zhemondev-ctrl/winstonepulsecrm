import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import type { RetryMode, RetrySlot } from "@/lib/no-answer-cadence";

export type RetryPick = { mode: RetryMode; slot: RetrySlot; time: string; customAt: string };
export const DEFAULT_RETRY_PICK: RetryPick = { mode: "plus2", slot: "morning", time: "", customAt: "" };

/** Missed-call retry choice. The server applies the 3-attempt rule and closed days. */
export function NoAnswerRetryPicker({ value, onChange }: { value: RetryPick; onChange: (v: RetryPick) => void }) {
  const t = useT();
  const modes: { key: RetryMode; label: { bn: string; en: string } }[] = [
    { key: "plus1", label: { bn: "+১ দিন", en: "+1 day" } },
    { key: "plus2", label: { bn: "+২ দিন", en: "+2 days" } },
    { key: "custom", label: { bn: "নিজে তারিখ ও সময়", en: "Custom Date & Time" } },
  ];
  const slots: { key: RetrySlot; label: { bn: string; en: string } }[] = [
    { key: "morning", label: { bn: "সকাল", en: "Morning" } },
    { key: "afternoon", label: { bn: "দুপুর", en: "Afternoon" } },
    { key: "evening", label: { bn: "সন্ধ্যা", en: "Evening" } },
    { key: "custom", label: { bn: "নিজে সময়", en: "Custom Time" } },
  ];
  const minLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="text-xs font-semibold">{t({ bn: "আবার কখন কল করবেন?", en: "When should we call again?" })}</Label>
      <div className="flex flex-wrap gap-1.5" role="group">
        {modes.map((m) => (
          <Button key={m.key} type="button" size="sm" variant={value.mode === m.key ? "default" : "outline"} aria-pressed={value.mode === m.key} onClick={() => onChange({ ...value, mode: m.key })}>
            {t(m.label)}
          </Button>
        ))}
      </div>
      {value.mode === "custom" ? (
        <Input type="datetime-local" min={minLocal} value={value.customAt} onChange={(e) => onChange({ ...value, customAt: e.target.value })} aria-label={t({ bn: "তারিখ ও সময়", en: "Date and time" })} />
      ) : (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t({ bn: "পছন্দের সময়", en: "Preferred time" })}>
          {slots.map((s) => (
            <Button key={s.key} type="button" size="sm" variant={value.slot === s.key ? "secondary" : "outline"} aria-pressed={value.slot === s.key} onClick={() => onChange({ ...value, slot: s.key })}>
              {t(s.label)}
            </Button>
          ))}
          {value.slot === "custom" ? (
            <Input type="time" className="h-8 w-28" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} aria-label={t({ bn: "সময়", en: "Time" })} />
          ) : null}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t({
          bn: "১ম বার না ধরলে লিডটি ২ ঘণ্টা পর আজকের তালিকায় আবার আসবে (বিকেল ৫টার পরে হলে পরের কার্যদিবস সকালে) — এই পছন্দ তখন লাগবে না। ২য় বার না ধরলে এখানে বেছে নেওয়া সময় লাগবে, সর্বোচ্চ ৪৮ ঘণ্টার মধ্যে, সাথে সফট মেসেজের ড্রাফট। ৩য় বার হলে লিডটি Unresponsive Pool-এ যাবে এবং ৭ দিন পর আবার আসবে। লিড আপনার কাছেই থাকবে।",
          en: "After a 1st miss the lead comes back on today's list 2 hours later (next working morning if that is after 5 PM) — this choice isn't used then. After a 2nd miss the time chosen here is used, at most 48 hours ahead, with a soft message draft. A 3rd miss moves the lead to the Unresponsive Pool and it returns after 7 days. The lead stays with you.",
        })}
      </p>
    </div>
  );
}
