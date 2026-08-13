import { err, ErrorCode, type Result } from "@aos/common";

import type { CreativePackage } from "../../domain/entities/CreativePackage.js";
import { CreativeAgentError } from "../../domain/errors/CreativeAgentError.js";
import { GenerationStatus } from "../../domain/value-objects/GenerationStatus.js";
import type { JobId } from "../../domain/value-objects/JobId.js";
import type { GenerationJobRegistry } from "../../registry/GenerationJobRegistry.js";
import type { KaiAgentService } from "../services/KaiAgentService.js";

/**
 * Re-drives a `FAILED` `GenerationJob`'s original `CreativeBrief` through
 * `KaiAgentService.processCreativeBrief` again (spec "application/use-cases/
 * RetryFailedGeneration.ts"). The job's own stored `brief` (`GenerationJob.brief`) is what makes
 * this possible without the caller having to re-supply the brief — Kai remembers what it was
 * asked to do.
 */
export class RetryFailedGeneration {
  constructor(
    private readonly jobRegistry: GenerationJobRegistry,
    private readonly kaiAgentService: KaiAgentService,
  ) {}

  async execute(
    jobId: JobId,
    correlationId?: string,
  ): Promise<Result<CreativePackage, CreativeAgentError>> {
    const job = this.jobRegistry.get(jobId);
    if (job === undefined) {
      return err(
        new CreativeAgentError(
          ErrorCode.NOT_FOUND,
          `RetryFailedGeneration: unknown jobId "${jobId.toString()}"`,
        ),
      );
    }
    if (job.status !== GenerationStatus.FAILED) {
      return err(
        new CreativeAgentError(
          ErrorCode.CONFLICT,
          `RetryFailedGeneration: job "${jobId.toString()}" is not FAILED (current status: ${job.status})`,
        ),
      );
    }

    return this.kaiAgentService.processCreativeBrief(job.brief, correlationId);
  }
}
