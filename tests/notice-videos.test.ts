import { describe, expect, it } from "vitest";

import { NOTICE_VIDEOS, formatClock, nextNoticeVideoIndex, progressPercent } from "@/lib/notice-videos";

describe("notice videos", () => {
  it("start with the long CRM walkthrough, then the two short videos", () => {
    expect(NOTICE_VIDEOS.map((v) => v.url.split("/").pop())).toEqual([
      "winstone-pulse-crm-voiceover-slideshow.mp4",
      "winstone-crm-recommendation-risks-bangla.mp4",
      "winstone-pulse-it-response-bangla.mp4",
    ]);
  });
  it("every video has Bangla captions", () => {
    for (const v of NOTICE_VIDEOS) expect(v.captions).toMatch(/\.bn\.vtt$/);
  });
  it("next video after the last one is the first (loop)", () => {
    expect(nextNoticeVideoIndex(0)).toBe(1);
    expect(nextNoticeVideoIndex(2)).toBe(0);
  });
  it("progress line values", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(1018)).toBe("16:58");
    expect(formatClock(Number.NaN)).toBe("--:--");
    expect(progressPercent(509, 1018)).toBe(50);
    expect(progressPercent(10, 0)).toBe(0);
  });
});
