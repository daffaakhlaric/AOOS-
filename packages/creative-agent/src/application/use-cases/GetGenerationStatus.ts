import type { GenerationJob } from "../../domain/entities/GenerationJob.js";
import type { JobId } from "../../domain/value-objects/JobId.js";
import type { GenerationJobRegistry } from "../../registry/GenerationJobRegistry.js";

/** Reads back one `GenerationJob`'s current state (spec "application/use-cases/GetGenerationStatus.ts") — `undefined` when `jobId` is unknown to this registry (never seen, or a different Kai instance's job). */
export class GetGenerationStatus {
  constructor(private readonly jobRegistry: GenerationJobRegistry) {}

  execute(jobId: JobId): GenerationJob | undefined {
    return this.jobRegistry.get(jobId);
  }
}
