import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { NOTICE_VIDEOS, formatClock, nextNoticeVideoIndex, progressPercent } from "@/lib/notice-videos";
import { useT } from "@/lib/i18n";

/** Notice videos: auto-play in a loop for signed-in staff while the development notice is on. */
export function NoticeVideos() {
  const t = useT();
  const ref = useRef<HTMLVideoElement>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const today = true; // plays for as long as the development notice is on
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: Number.NaN });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(Boolean(s)));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Try with sound first; browsers that block it get a muted start and an unmute button.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = false;
    void video.play().then(
      () => setMuted(false),
      () => {
        video.muted = true;
        setMuted(true);
        void video.play().catch(() => {});
      },
    );
  }, [index, signedIn, today]);

  if (!today || !signedIn) {
    if (today && signedIn === false) {
      return <p className="text-xs text-muted-foreground">{t({ bn: "আজকের ভিডিও দেখতে সাইন ইন করুন।", en: "Sign in to watch today's videos." })}</p>;
    }
    return null;
  }
  const current = NOTICE_VIDEOS[index]!;
  const next = NOTICE_VIDEOS[nextNoticeVideoIndex(index)]!;
  const pct = progressPercent(time.current, time.duration);
  const left = Number.isFinite(time.duration) ? time.duration - time.current : Number.NaN;
  return (
    <section className="min-w-0 space-y-2" aria-label={t({ bn: "নোটিশের ভিডিও", en: "Notice videos" })}>
      <p className="text-sm font-semibold">
        {t({ bn: "এখন চলছে", en: "Now playing" })} {index + 1}/{NOTICE_VIDEOS.length} · {t(current.title)}
      </p>
      <div className="relative overflow-hidden rounded-lg bg-muted">
        <video
          key={current.url}
          ref={ref}
          src={current.url}
          autoPlay
          playsInline
          controls
          preload="auto"
          className="aspect-video w-full max-w-full"
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onLoadedMetadata={(e) => setTime({ current: 0, duration: e.currentTarget.duration })}
          onTimeUpdate={(e) => setTime({ current: e.currentTarget.currentTime, duration: e.currentTarget.duration })}
          onEnded={() => setIndex((i) => nextNoticeVideoIndex(i))}
        >
          <track kind="captions" src={current.captions} srcLang="bn" label="বাংলা" default />
        </video>
        {muted && (
          <Button
            size="sm"
            className="absolute left-2 top-2"
            onClick={() => {
              const v = ref.current;
              if (!v) return;
              v.muted = false;
              setMuted(false);
              void v.play().catch(() => {});
            }}
          >
            <Volume2 className="size-4" /> {t({ bn: "সাউন্ড চালু করুন", en: "Turn sound on" })}
          </Button>
        )}
      </div>
      <div className="space-y-1" aria-live="off">
        <Progress value={pct} aria-label={t({ bn: "ভিডিওর অগ্রগতি", en: "Video progress" })} />
        <p className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
          <span>
            {formatClock(time.current)} / {formatClock(time.duration)} · {pct}%
          </span>
          <span>
            {t({ bn: "বাকি", en: "Left" })} {formatClock(left)}
          </span>
        </p>
        <p className="text-xs">
          <span className="font-semibold">{t({ bn: "পরের ভিডিও", en: "Up next" })}:</span> {nextNoticeVideoIndex(index) + 1}. {t(next.title)}
          {nextNoticeVideoIndex(index) === 0 && <span className="text-muted-foreground"> ({t({ bn: "আবার শুরু থেকে", en: "starts over" })})</span>}
        </p>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {NOTICE_VIDEOS.map((v, i) => (
          <li key={v.url}>
            <Button size="sm" className="h-auto min-h-8 whitespace-normal py-1 text-left" variant={i === index ? "default" : "outline"} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)}>
              {i + 1}. {t(v.title)}
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
