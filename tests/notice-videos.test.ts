import { describe, expect, it } from "vitest";

import { NOTICE_VIDEOS, noticeVideosToday } from "@/lib/notice-videos";

describe("today's notice videos", () => {
  it("play only on 12 November 2026, Dhaka time", () => {
    expect(noticeVideosToday(new Date("2026-11-11T18:00:00Z"))).toBe(true); // 00:00 Dhaka, Nov 12
    expect(noticeVideosToday(new Date("2026-11-12T17:59:59Z"))).toBe(true); // 23:59:59 Dhaka
    expect(noticeVideosToday(new Date("2026-11-12T18:00:00Z"))).toBe(false); // Nov 13 Dhaka
  });
  it("start with the long CRM walkthrough, then the two short videos", () => {
    expect(NOTICE_VIDEOS.map((v) => v.url.split("/").pop())).toEqual([
      "winstone-pulse-crm-voiceover-slideshow.mp4",
      "winstone-crm-recommendation-risks-bangla.mp4",
      "winstone-pulse-it-response-bangla.mp4",
    ]);
  });
});
