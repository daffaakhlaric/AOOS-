import { describe, expect, it } from "vitest";

import { GetGenerationStatus } from "../../../../src/application/use-cases/GetGenerationStatus.js";
import { GenerationJobBuilder } from "../../../../src/builders/GenerationJobBuilder.js";
import { JobId } from "../../../../src/domain/value-objects/JobId.js";
import { GenerationJobRegistry } from "../../../../src/registry/GenerationJobRegistry.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";

describe("GetGenerationStatus", () => {
  it("returns the job when it exists in the registry", () => {
    const registry = new GenerationJobRegistry();
    const job = GenerationJobBuilder.pending(buildBrief(), new Date());
    registry.upsert(job);

    const useCase = new GetGenerationStatus(registry);
    expect(useCase.execute(job.id)).toBe(job);
  });

  it("returns undefined for an unknown jobId", () => {
    const registry = new GenerationJobRegistry();
    const useCase = new GetGenerationStatus(registry);
    expect(useCase.execute(JobId.generate())).toBeUndefined();
  });
});
