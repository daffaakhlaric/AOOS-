import { describe, expect, it, vi } from "vitest";

import type { KaiAgentService } from "../../../../src/application/services/KaiAgentService.js";
import { RetryFailedGeneration } from "../../../../src/application/use-cases/RetryFailedGeneration.js";
import { GenerationJobBuilder } from "../../../../src/builders/GenerationJobBuilder.js";
import { GenerationStatus } from "../../../../src/domain/value-objects/GenerationStatus.js";
import { JobId } from "../../../../src/domain/value-objects/JobId.js";
import { GenerationJobRegistry } from "../../../../src/registry/GenerationJobRegistry.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";
import { okResult } from "../../../helpers/mocks.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("RetryFailedGeneration", () => {
  it("re-drives a FAILED job's original brief through KaiAgentService", async () => {
    const registry = new GenerationJobRegistry();
    const brief = buildBrief();
    const job = GenerationJobBuilder.pending(brief, new Date()).withFailure("boom", new Date());
    registry.upsert(job);

    const processCreativeBrief = vi.fn().mockResolvedValue(okResult({ id: "pkg-retry" }));
    const kaiAgentService = { processCreativeBrief } as unknown as KaiAgentService;
    const useCase = new RetryFailedGeneration(registry, kaiAgentService);

    const result = unwrap(await useCase.execute(job.id, "cid-retry"));
    expect(result).toEqual({ id: "pkg-retry" });
    expect(processCreativeBrief).toHaveBeenCalledWith(brief, "cid-retry");
  });

  it("returns NOT_FOUND for an unknown jobId", async () => {
    const registry = new GenerationJobRegistry();
    const kaiAgentService = { processCreativeBrief: vi.fn() } as unknown as KaiAgentService;
    const useCase = new RetryFailedGeneration(registry, kaiAgentService);

    const error = unwrapErr(await useCase.execute(JobId.generate()));
    expect(error.code).toBe("NOT_FOUND");
  });

  it("returns CONFLICT when the job is not FAILED", async () => {
    const registry = new GenerationJobRegistry();
    const job = GenerationJobBuilder.pending(buildBrief(), new Date());
    registry.upsert(job);
    expect(job.status).toBe(GenerationStatus.PENDING);

    const kaiAgentService = { processCreativeBrief: vi.fn() } as unknown as KaiAgentService;
    const useCase = new RetryFailedGeneration(registry, kaiAgentService);

    const error = unwrapErr(await useCase.execute(job.id));
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("not FAILED");
  });
});
