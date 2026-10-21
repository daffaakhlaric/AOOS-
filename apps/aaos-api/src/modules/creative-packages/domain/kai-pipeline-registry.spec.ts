import { expect, it } from "vitest";

import { selectKaiPipeline } from "./kai-pipeline-registry.js";
it("selects a distinct production path for each format without inventing provider cost", () => {
  expect(selectKaiPipeline("IMAGE", 3).stages).toContain("ART_DIRECTION");
  expect(selectKaiPipeline("VIDEO", 3).stages).toContain("STORYBOARD");
  expect(selectKaiPipeline("CAROUSEL", 3).stages).toContain("SLIDE_PLAN");
  expect(selectKaiPipeline("VIDEO", 3).costEstimate).toBeNull();
});
it("requires real source photos before planning an executable pipeline", () => {
  expect(() => selectKaiPipeline("VIDEO", 0)).toThrow("SOURCE_MEDIA_REQUIRED");
});
