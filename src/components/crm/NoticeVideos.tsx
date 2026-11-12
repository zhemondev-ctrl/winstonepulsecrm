import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { NOTICE_VIDEOS } from "@/lib/notice-videos";
import { useT } from "@/lib/i18n";

/** Notice videos: auto-play in a loop for signed-in staff while the development notice is on. */
export function NoticeVideos() {
  const t = useT();
  const ref = useRef<HTMLVideoElement>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const today = true; // plays for as long as the development notice is on
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);

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
  return (
    <section className="min-w-0 space-y-2" aria-label={t({ bn: "আজকের ভিডিও", en: "Today's videos" })}>
      <p className="text-sm font-semibold">
        {index + 1}/{NOTICE_VIDEOS.length} · {t(current.title)}
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
          onEnded={() => setIndex((i) => (i + 1) % NOTICE_VIDEOS.length)}
        />
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
      <ol className="flex flex-wrap gap-1.5">
        {NOTICE_VIDEOS.map((v, i) => (
          <li key={v.url}>
            <Button size="sm" className="h-auto min-h-8 whitespace-normal py-1 text-left" variant={i === index ? "default" : "outline"} onClick={() => setIndex(i)}>
              {i + 1}. {t(v.title)}
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
