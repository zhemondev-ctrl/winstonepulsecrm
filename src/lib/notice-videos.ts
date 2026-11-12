import slideshow from "@/assets/videos/winstone-pulse-crm-voiceover-slideshow.mp4.asset.json";
import risks from "@/assets/videos/winstone-crm-recommendation-risks-bangla.mp4.asset.json";
import itResponse from "@/assets/videos/winstone-pulse-it-response-bangla.mp4.asset.json";
import slideshowCaptions from "@/assets/videos/winstone-pulse-crm-voiceover-slideshow.bn.vtt.asset.json";
import risksCaptions from "@/assets/videos/winstone-crm-recommendation-risks-bangla.bn.vtt.asset.json";
import itResponseCaptions from "@/assets/videos/winstone-pulse-it-response-bangla.bn.vtt.asset.json";

/** Play order: the ~17-minute CRM walkthrough first, then the two short videos; loops while the notice is on. */
export const NOTICE_VIDEOS = [
  { url: slideshow.url, captions: slideshowCaptions.url, title: { bn: "CRM কীভাবে চলে — পূর্ণ ভিডিও (১৭ মিনিট)", en: "How the CRM works — full video (17 min)" } },
  { url: risks.url, captions: risksCaptions.url, title: { bn: "নতুন প্রস্তাব ও ঝুঁকি (৯ মিনিট)", en: "New recommendations and risks (9 min)" } },
  { url: itResponse.url, captions: itResponseCaptions.url, title: { bn: "IT Console-এর ব্যাখ্যা (৭ মিনিট)", en: "IT Console explanation (7 min)" } },
] as const;

/** The video that plays after `index` (wraps back to the first). */
export function nextNoticeVideoIndex(index: number): number {
  return (index + 1) % NOTICE_VIDEOS.length;
}

/** mm:ss (or h:mm:ss) for the progress line; unknown/invalid → "--:--". */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Whole-number percent watched, clamped 0–100; 0 when the length is unknown. */
export function progressPercent(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return 0;
  return Math.min(100, Math.max(0, Math.round((current / duration) * 100)));
}
