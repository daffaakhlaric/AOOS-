import { describe, expect, it } from "vitest";

import { GenerationJobBuilder } from "../../../src/builders/GenerationJobBuilder.js";
import { GenerationStatus } from "../../../src/domain/value-objects/GenerationStatus.js";
import { JobId } from "../../../src/domain/value-objects/JobId.js";
import { GenerationJobRegistry } from "../../../src/registry/GenerationJobRegistry.js";
import { buildBrief } from "../../fixtures/creativeBriefFixtures.js";

describe("GenerationJobRegistry", () => {
  it("upsert() then get() returns the same job", () => {
    const registry = new GenerationJobRegistry();
    const job = GenerationJobBuilder.pending(buildBrief(), new Date());
    registry.upsert(job);
    expect(registry.get(job.id)).toBe(job);
  });

  it("get() returns undefined for an unknown id", () => {
    const registry = new GenerationJobRegistry();
    expect(registry.get(JobId.generate())).toBeUndefined();
  });

  it("upsert() overwrites the job at the same id (state transitions)", () => {
    const registry = new GenerationJobRegistry();
    const job = GenerationJobBuilder.pending(buildBrief(), new Date());
    registry.upsert(job);

    const updated = job.withStatus(GenerationStatus.GENERATING);
    registry.upsert(updated);

    expect(registry.get(job.id)?.status).toBe(GenerationStatus.GENERATING);
  });

  it("all() returns every registered job", () => {
    const registry = new GenerationJobRegistry();
    const a = GenerationJobBuilder.pending(buildBrief(), new Date());
    const b = GenerationJobBuilder.pending(buildBrief(), new Date());
    registry.upsert(a);
    registry.upsert(b);

    expect(registry.all()).toHaveLength(2);
  });

  it("all() returns an empty array for a fresh registry", () => {
    expect(new GenerationJobRegistry().all()).toEqual([]);
  });
});
