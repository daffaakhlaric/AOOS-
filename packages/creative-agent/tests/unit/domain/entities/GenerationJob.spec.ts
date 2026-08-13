import { describe, expect, it } from "vitest";

import { GenerationJob } from "../../../../src/domain/entities/GenerationJob.js";
import { CreativeFormat } from "../../../../src/domain/value-objects/CreativeFormat.js";
import { GenerationStatus } from "../../../../src/domain/value-objects/GenerationStatus.js";
import { JobId } from "../../../../src/domain/value-objects/JobId.js";
import { PackageId } from "../../../../src/domain/value-objects/PackageId.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";

describe("GenerationJob", () => {
  it("create() builds a PENDING job with the given brief", () => {
    const brief = buildBrief();
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    const job = GenerationJob.create({
      id: JobId.generate(),
      brief,
      status: GenerationStatus.PENDING,
      startedAt,
    });

    expect(job.status).toBe(GenerationStatus.PENDING);
    expect(job.brief).toBe(brief);
    expect(job.startedAt).toEqual(startedAt);
    expect(job.format).toBeUndefined();
    expect(job.packageId).toBeUndefined();
    expect(job.failureReason).toBeUndefined();
    expect(job.completedAt).toBeUndefined();
  });

  it("withStatus() transitions status and preserves other fields", () => {
    const job = GenerationJob.create({
      id: JobId.generate(),
      brief: buildBrief(),
      status: GenerationStatus.PENDING,
      startedAt: new Date(),
    });
    const generating = job.withStatus(GenerationStatus.GENERATING);
    expect(generating.status).toBe(GenerationStatus.GENERATING);
    expect(generating.id).toBe(job.id);
  });

  it("withStatus() can set completedAt", () => {
    const job = GenerationJob.create({
      id: JobId.generate(),
      brief: buildBrief(),
      status: GenerationStatus.PENDING,
      startedAt: new Date(),
    });
    const completedAt = new Date("2026-08-01T01:00:00.000Z");
    const done = job.withStatus(GenerationStatus.READY, completedAt);
    expect(done.completedAt).toEqual(completedAt);
  });

  it("withFormat() sets the decided format", () => {
    const job = GenerationJob.create({
      id: JobId.generate(),
      brief: buildBrief(),
      status: GenerationStatus.PENDING,
      startedAt: new Date(),
    });
    const withFormat = job.withFormat(CreativeFormat.VIDEO_AND_IMAGES);
    expect(withFormat.format).toBe(CreativeFormat.VIDEO_AND_IMAGES);
  });

  it("withReady() sets status READY, packageId, and completedAt", () => {
    const job = GenerationJob.create({
      id: JobId.generate(),
      brief: buildBrief(),
      status: GenerationStatus.GENERATING,
      startedAt: new Date(),
    });
    const packageId = PackageId.generate();
    const completedAt = new Date("2026-08-01T02:00:00.000Z");
    const ready = job.withReady(packageId, completedAt);

    expect(ready.status).toBe(GenerationStatus.READY);
    expect(ready.packageId).toBe(packageId);
    expect(ready.completedAt).toEqual(completedAt);
  });

  it("withFailure() sets status FAILED, failureReason, and completedAt", () => {
    const job = GenerationJob.create({
      id: JobId.generate(),
      brief: buildBrief(),
      status: GenerationStatus.GENERATING,
      startedAt: new Date(),
    });
    const completedAt = new Date("2026-08-01T03:00:00.000Z");
    const failed = job.withFailure("all images failed", completedAt);

    expect(failed.status).toBe(GenerationStatus.FAILED);
    expect(failed.failureReason).toBe("all images failed");
    expect(failed.completedAt).toEqual(completedAt);
  });

  it("state transitions return a NEW GenerationJob instance (immutability)", () => {
    const job = GenerationJob.create({
      id: JobId.generate(),
      brief: buildBrief(),
      status: GenerationStatus.PENDING,
      startedAt: new Date(),
    });
    const next = job.withStatus(GenerationStatus.GENERATING);
    expect(next).not.toBe(job);
    expect(job.status).toBe(GenerationStatus.PENDING);
  });
});
