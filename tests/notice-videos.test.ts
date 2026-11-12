import { describe, expect, it } from "vitest";

import { NOTICE_VIDEOS } from "@/lib/notice-videos";

describe("today's notice videos", () => {
  it("start with the long CRM walkthrough, then the two short videos", () => {
    expect(NOTICE_VIDEOS.map((v) => v.url.split("/").pop())).toEqual([
      "winstone-pulse-crm-voiceover-slideshow.mp4",
      "winstone-crm-recommendation-risks-bangla.mp4",
      "winstone-pulse-it-response-bangla.mp4",
    ]);
  });
});
