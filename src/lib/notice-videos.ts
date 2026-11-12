import slideshow from "@/assets/videos/winstone-pulse-crm-voiceover-slideshow.mp4.asset.json";
import risks from "@/assets/videos/winstone-crm-recommendation-risks-bangla.mp4.asset.json";
import itResponse from "@/assets/videos/winstone-pulse-it-response-bangla.mp4.asset.json";

/** The only Dhaka day the notice videos play (owner request: "just today"). */
export const NOTICE_VIDEOS_DHAKA_DATE = "2026-11-12";

/** Play order: the ~17-minute CRM walkthrough first, then the two short videos. */
export const NOTICE_VIDEOS = [
  { url: slideshow.url, title: { bn: "CRM কীভাবে চলে — পূর্ণ ভিডিও (১৭ মিনিট)", en: "How the CRM works — full video (17 min)" } },
  { url: risks.url, title: { bn: "নতুন প্রস্তাব ও ঝুঁকি (৯ মিনিট)", en: "New recommendations and risks (9 min)" } },
  { url: itResponse.url, title: { bn: "IT Console-এর ব্যাখ্যা (৭ মিনিট)", en: "IT Console explanation (7 min)" } },
] as const;

export function dhakaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function noticeVideosToday(now: Date = new Date()): boolean {
  return dhakaDate(now) === NOTICE_VIDEOS_DHAKA_DATE;
}
