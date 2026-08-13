import { describe, expect, it } from "vitest";

import { GenerationJobBuilder } from "../../../src/builders/GenerationJobBuilder.js";
import { GenerationStatus } from "../../../src/domain/value-objects/GenerationStatus.js";
import { buildBrief } from "../../fixtures/creativeBriefFixtures.js";

describe("GenerationJobBuilder", () => {
  it("pending() builds a job with status PENDING", () => {
    const brief = buildBrief();
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    const job = GenerationJobBuilder.pending(brief, startedAt);

    expect(job.status).toBe(GenerationStatus.PENDING);
    expect(job.brief).toBe(brief);
    expect(job.startedAt).toEqual(startedAt);
  });

  it("pending() generates a fresh JobId on every call", () => {
    const brief = buildBrief();
    const a = GenerationJobBuilder.pending(brief, new Date());
    const b = GenerationJobBuilder.pending(brief, new Date());
    expect(a.id.equals(b.id)).toBe(false);
  });
});
