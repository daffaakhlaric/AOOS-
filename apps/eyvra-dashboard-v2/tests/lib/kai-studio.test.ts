import { describe, it, expect } from "vitest";
import {
  mapKaiConceptToCard,
  mapQAResult,
  productionSteps,
  batchProgress,
  mapKaiBriefToViewModel,
  type KaiPackage,
} from "@/lib/kai-studio";
const pkg = {
  id: "p1",
  briefId: "b1",
  title: "Test concept",
  status: "GENERATING",
  imageUrls: [],
  sourcePhotoUrls: ["source.jpg"],
  angle: "LOCATION",
  requestedFormat: "IMAGES_ONLY",
  createdAt: "2026-09-22",
  confidenceScore: 91,
} as unknown as KaiPackage;
describe("Kai production evidence", () => {
  it("does not invent QA from confidence or source media", () => {
    const c = mapKaiConceptToCard(pkg);
    expect(c.qa.status).toBe("Unavailable");
    expect(c.generated).toBe(false);
    expect(productionSteps([c])[2]?.state).toBe("Pending");
  });
  it("keeps render variants in a single concept", () => {
    const c = mapKaiConceptToCard({ ...pkg, imageUrls: ["a", "b"], videoUrl: "v" });
    expect(c.media).toHaveLength(3);
    expect(batchProgress([c]).total).toBe(1);
  });
  it("uses latest structured QA evidence", () => {
    expect(
      mapQAResult([
        {
          id: "a",
          eventType: "QA",
          message: "",
          createdAt: "2026-01-01",
          metadata: { qaPassed: false },
        },
        {
          id: "b",
          eventType: "QA",
          message: "",
          createdAt: "2026-01-02",
          metadata: {
            qaPassed: true,
            qaChecks: [{ check: "dimensions", passed: true, detail: "valid" }],
          },
        },
      ]).status,
    ).toBe("Passed");
  });
  it("does not mark approved missing media ready", () => {
    expect(mapKaiConceptToCard({ ...pkg, status: "APPROVED" }).status).toBe("Asset missing");
  });
  it("keeps failed generation distinct from QA failure", () => {
    expect(mapKaiConceptToCard({ ...pkg, status: "FAILED" }).status).toBe("Generation failed");
  });
  it("never infers experiment or winner from linked ads", () => {
    const c = mapKaiConceptToCard({ ...pkg, publishedMetaAdIds: ["ad"] });
    expect(
      productionSteps([c])
        .slice(6)
        .map((s) => s.state),
    ).toEqual(["Pending", "Pending"]);
  });
  it("groups only exact brief identities", () => {
    expect(
      mapKaiBriefToViewModel([pkg, { ...pkg, id: "p2", briefId: "b2" }], "b1").concepts,
    ).toHaveLength(1);
  });
});
