import type { CreativeBrief } from "@aos/meta-ads-agent";

import { GenerationJob } from "../domain/entities/GenerationJob.js";
import { GenerationStatus } from "../domain/value-objects/GenerationStatus.js";
import { JobId } from "../domain/value-objects/JobId.js";

/** Builder Pattern (spec "builders/GenerationJobBuilder.ts") — the single place a brand-new, `PENDING` `GenerationJob` gets constructed, mirroring `CopyVariantBuilder`'s role for `CopyVariant`. */
export class GenerationJobBuilder {
  static pending(brief: CreativeBrief, startedAt: Date): GenerationJob {
    return GenerationJob.create({
      id: JobId.generate(),
      brief,
      status: GenerationStatus.PENDING,
      startedAt,
    });
  }
}
