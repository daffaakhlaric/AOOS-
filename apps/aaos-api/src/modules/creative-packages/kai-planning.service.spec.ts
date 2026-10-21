import { expect, it, vi } from "vitest";

import { defaultGrowthPolicy } from "../automation-policy/domain/growth-policy.js";
import type { GrowthPolicyService } from "../automation-policy/growth-policy.service.js";
import type { ListingsService } from "../listings/listings.service.js";
import type { LlmService } from "../llm/llm.service.js";

import type { CreativeHandoffRepository } from "./infrastructure/creative-handoff.repository.js";
import { KaiPlanningService } from "./kai-planning.service.js";
function setup(growth?: GrowthPolicyService) {
  const facts = [
    {
      text: "Rp 3,7 M",
      sourceId: "listing",
      sourceLocator: "listing.price",
      sourceType: "LISTING",
    },
  ];
  const brief = {
    listingId: "listing",
    briefId: "brief",
    factualClaims: facts,
    formats: [{ type: "IMAGE", quantity: 1, aspectRatios: ["4:5"] }],
    CTA: { label: "Hubungi", destination: "628123456789" },
  };
  const repo = {
    getProject: vi.fn().mockResolvedValue({ project: { status: "BRIEF_READY" }, brief }),
    getConcepts: vi.fn().mockResolvedValue([]),
    ensureConcepts: vi.fn(),
    enqueueReviewed: vi.fn().mockResolvedValue([]),
    listJobs: vi.fn().mockResolvedValue([]),
  };
  const plan = {
    title: "Harga jelas",
    family: "PRICE_VALUE",
    hypothesis: "Harga transparan membantu evaluasi",
    persona: "Pembeli",
    visualDirection: "Gunakan foto asli",
    claimIndices: [0],
    scenes: [{ purpose: "Penawaran", visualDirection: "Foto asli", claimIndex: 0 }],
  };
  const llm = {
    generateKaiConceptPlan: vi
      .fn()
      .mockResolvedValue({ available: true, plan: { concepts: [plan] } }),
  };
  const listings = {
    getById: vi.fn().mockResolvedValue({ photos: [{ url: "https://assets.example/source.jpg" }] }),
  };
  const service = new KaiPlanningService(
    repo as unknown as CreativeHandoffRepository,
    llm as unknown as LlmService,
    listings as unknown as ListingsService,
    growth,
  );
  return { repo, llm, service, plan, brief, listings };
}
it("rejects a format disabled by saved Growth Settings before paying for concepts", async () => {
  const policy = defaultGrowthPolicy();
  policy.creativePolicy.allowImage = false;
  const { service, llm } = setup({
    current: vi.fn(async () => ({ version: 2, policy })),
  } as unknown as GrowthPolicyService);
  await expect(service.generate("tenant", "project")).rejects.toThrow("Format brief");
  expect(llm.generateKaiConceptPlan).not.toHaveBeenCalled();
});
it("records the policy version and creative preferences in generated concepts", async () => {
  const policy = defaultGrowthPolicy();
  policy.creativePolicy.quality = "PREMIUM";
  const { service, repo } = setup({
    current: vi.fn(async () => ({ version: 3, policy })),
  } as unknown as GrowthPolicyService);
  await service.generate("tenant", "project");
  expect(repo.ensureConcepts).toHaveBeenCalledWith(
    "tenant",
    "project",
    "brief",
    expect.arrayContaining([
      expect.objectContaining({
        growthPolicyVersion: 3,
        creativePolicy: expect.objectContaining({ quality: "PREMIUM" }),
      }),
    ]),
  );
});
it("returns persisted concepts without calling a paid LLM again", async () => {
  const { repo, llm, service } = setup();
  repo.getConcepts.mockResolvedValue([{ id: "saved" }]);
  expect(await service.generate("tenant", "project")).toEqual([{ id: "saved" }]);
  expect(llm.generateKaiConceptPlan).not.toHaveBeenCalled();
});
it("copies exact sourced facts into storyboard and persists the same brief lineage", async () => {
  const { repo, service } = setup();
  await service.generate("tenant", "project");
  expect(repo.ensureConcepts).toHaveBeenCalledWith(
    "tenant",
    "project",
    "brief",
    expect.arrayContaining([
      expect.objectContaining({
        message: "Rp 3,7 M",
        qaStatus: "NOT_RUN",
        storyboard: expect.objectContaining({
          scenes: expect.arrayContaining([
            expect.objectContaining({
              overlayText: "Rp 3,7 M",
              provenance: expect.objectContaining({ sourceLocator: "listing.price" }),
            }),
          ]),
        }),
      }),
    ]),
  );
});
it("rejects nonexistent claim indices without saving misleading copy", async () => {
  const { repo, service, plan } = setup();
  plan.claimIndices = [99];
  await expect(service.generate("tenant", "project")).rejects.toThrow("fakta yang tidak tersedia");
  expect(repo.ensureConcepts).not.toHaveBeenCalled();
});
it("uses the selected main photo for an image instead of the first uploaded floorplan", async () => {
  const { repo, service, listings } = setup();
  listings.getById.mockResolvedValue({
    photos: [
      { url: "https://assets.example/floorplan.jpg", isMain: false },
      { url: "https://assets.example/exterior.jpg", isMain: true },
    ],
  } as never);
  await service.generate("tenant", "project");
  expect(repo.ensureConcepts.mock.calls[0]![3][0].storyboard.scenes[0].sourceUrl).toBe(
    "https://assets.example/exterior.jpg",
  );
});
it("does not fabricate concepts when provider is unavailable", async () => {
  const { repo, llm, service } = setup();
  llm.generateKaiConceptPlan.mockResolvedValue({
    available: false,
    reason: "PROVIDER_ERROR",
  } as never);
  await expect(service.generate("tenant", "project")).rejects.toThrow("PROVIDER_ERROR");
  expect(repo.ensureConcepts).not.toHaveBeenCalled();
});

it("rejects duplicate or malformed concept IDs before looking up a project", async () => {
  const { service, repo } = setup();
  const id = "32c6e185-c3f2-4eeb-b340-d0def82e8b70";
  for (const ids of [[id, id], ["invalid"], [], Array(11).fill(id)])
    await expect(service.enqueue("tenant", "project", ids)).rejects.toThrow("konsep unik");
  expect(repo.getProject).not.toHaveBeenCalled();
  expect(repo.enqueueReviewed).not.toHaveBeenCalled();
});

it("rejects another project's concept before enqueueing", async () => {
  const { service, repo } = setup();
  await expect(
    service.enqueue("tenant", "project", ["32c6e185-c3f2-4eeb-b340-d0def82e8b70"]),
  ).rejects.toThrow("proyek ini");
  expect(repo.enqueueReviewed).not.toHaveBeenCalled();
});

it("enqueues only the requested persisted concept", async () => {
  const { service, repo } = setup();
  const id = "32c6e185-c3f2-4eeb-b340-d0def82e8b70";
  repo.getConcepts.mockResolvedValue([{ id }, { id: "81b228a3-31f7-45b2-b54a-70fd869303fc" }]);
  await expect(service.enqueue("tenant", "project", [id])).rejects.toThrow("tinjau versi");
  expect(repo.enqueueReviewed).not.toHaveBeenCalled();
  await service.enqueue("tenant", "project", [id], "FULL", { [id]: 1 });
  expect(repo.enqueueReviewed).toHaveBeenCalledWith("tenant", "project", [id], { [id]: 1 }, "FULL");
});
