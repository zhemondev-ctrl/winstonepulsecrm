import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_VIEW_MODE, parseLeadViewMode } from "@/lib/lead-view-mode";

describe("lead dashboard view mode", () => {
  it("defaults to cards when nothing is saved", () => {
    expect(DEFAULT_LEAD_VIEW_MODE).toBe("cards");
    expect(parseLeadViewMode(null)).toBe("cards");
  });

  it("keeps a saved table choice", () => {
    expect(parseLeadViewMode("table")).toBe("table");
  });

  it("falls back to cards for unknown saved values", () => {
    expect(parseLeadViewMode("grid")).toBe("cards");
  });
});
