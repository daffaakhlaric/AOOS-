import { describe, expect, it, vi } from "vitest";

import type { ProductionJob } from "./domain/kai-production.js";
import { KaiProductionWorker } from "./kai-production.worker.js";

function setup(status = "QUEUED") {
  const fact = { text: "BSD", sourceId: "listing", sourceLocator: "title", sourceType: "LISTING" };
  const job = {
    tenant_id: "tenant",
    id: "job",
    project_id: "project",
    brief_id: "brief",
    concept_id: "concept",
    format: "VIDEO",
    status,
    attempt: 0,
    output: null,
    plan: {
      format: "VIDEO",
      durationSeconds: 2,
      scenes: [
        {
          id: "7edc942f-c9ed-47bc-8de4-ce7ff9217e7d",
          ordinal: 0,
          sourceUrl: "https://example.com/source.jpg",
          visualDirection: "Source",
          overlayText: "BSD",
          provenance: fact,
          startSeconds: 0,
          endSeconds: 2,
        },
      ],
    },
  } as unknown as ProductionJob;
  const updates: Partial<ProductionJob>[] = [];
  const jobs = {
    claim: vi.fn(async () => structuredClone(job)),
    context: vi.fn(async () => ({ aspectRatios: ["4:5"] })),
    update: vi.fn(async (current: ProductionJob, patch: Partial<ProductionJob>) => {
      updates.push(structuredClone(patch));
      return { ...current, ...structuredClone(patch) };
    }),
    syncPackage: vi.fn(),
  };
  const handoff = {
    getProject: vi.fn(async () => ({
      project: { creative_brief_id: "brief", status: "IN_PRODUCTION" },
      brief: { briefId: "brief", listingId: "listing", factualClaims: [fact] },
    })),
  };
  const listings = {
    getById: vi.fn(async () => ({ photos: [{ url: "https://example.com/source.jpg" }] })),
  };
  const media = {
    available: true,
    renderSourceMotion: vi.fn(async () => ({ id: "asset", url: "https://example.com/owned.mp4" })),
    ingest: vi.fn(),
  };
  const connector = {
    videoGenerationService: { generateFromImage: vi.fn() },
    imageGenerationService: { generate: vi.fn() },
  };
  const worker = new KaiProductionWorker(
    jobs as never,
    handoff as never,
    listings as never,
    media as never,
    connector as never,
  );
  return { worker, jobs, media, connector, updates, job };
}
describe("production checkpoint recovery", () => {
  it("completes sample QA without updating the final package inventory", async () => {
    const s = setup("QA");
    s.job.plan = { ...(s.job.plan as object), renderMode: "SAMPLE" };
    s.job.output = {
      cursor: 1,
      units: [],
      assets: [{ url: "https://example.com/sample.mp4" } as never],
      qa: { passed: true, checkedAt: new Date().toISOString(), checks: [] },
    };
    await s.worker.tick();
    expect(s.jobs.syncPackage).not.toHaveBeenCalled();
    expect(s.updates.at(-1)).toMatchObject({ status: "SAMPLE_READY" });
  });
  it("renders source motion and advances durably to QA without paid submission", async () => {
    const s = setup();
    await s.worker.tick();
    expect(s.media.renderSourceMotion).toHaveBeenCalledOnce();
    expect(s.connector.videoGenerationService.generateFromImage).not.toHaveBeenCalled();
    expect(s.updates.at(-1)).toMatchObject({
      status: "QA",
      output: { cursor: 1 },
      lease_owner: null,
    });
  });
  it("never resubmits an ambiguous paid request after restart", async () => {
    const s = setup("SUBMITTING");
    await s.worker.tick();
    expect(s.updates.at(-1)).toMatchObject({
      status: "FAILED",
      error_code: "SUBMISSION_UNCERTAIN",
    });
    expect(s.connector.videoGenerationService.generateFromImage).not.toHaveBeenCalled();
    expect(s.media.renderSourceMotion).not.toHaveBeenCalled();
  });
  it("retries a local render failure without submitting to KIE", async () => {
    const s = setup();
    s.media.renderSourceMotion.mockRejectedValueOnce(new Error("VIDEO_TOOLS_UNAVAILABLE"));
    await s.worker.tick();
    expect(s.updates.at(-1)).toMatchObject({
      status: "QUEUED",
      attempt: 1,
      error_code: "VIDEO_TOOLS_UNAVAILABLE",
    });
    expect(s.connector.videoGenerationService.generateFromImage).not.toHaveBeenCalled();
  });
});
