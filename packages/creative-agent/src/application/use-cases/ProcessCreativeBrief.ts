import { err, type Result } from "@aos/common";
import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { CreativePackage } from "../../domain/entities/CreativePackage.js";
import { BriefValidationError } from "../../domain/errors/BriefValidationError.js";
import type { CreativeAgentError } from "../../domain/errors/CreativeAgentError.js";
import type { KaiAgentService } from "../services/KaiAgentService.js";

/**
 * Main entry point (spec "application/use-cases/ProcessCreativeBrief.ts" — "main entry: brief ->
 * package"): brief -> `CreativePackage`. Thin wrapper over `KaiAgentService`, mirroring
 * `@aos/sales-agent`'s `ProcessIncomingMessage` -> `JessyAgentService` convention. Performs one
 * defensive re-check (step 1 of the spec's pipeline, "Validate brief (required fields present)")
 * on top of `@aos/meta-ads-agent`'s own `CreativeBrief.create` validation, which every real brief
 * already passed before Kai ever sees it.
 */
export class ProcessCreativeBrief {
  constructor(private readonly kaiAgentService: KaiAgentService) {}

  async execute(
    brief: CreativeBrief,
    correlationId?: string,
  ): Promise<Result<CreativePackage, CreativeAgentError>> {
    if (brief.formats.length === 0) {
      return err(
        new BriefValidationError(
          `ProcessCreativeBrief: brief ${brief.id.toString()} has no requested formats`,
        ),
      );
    }

    return this.kaiAgentService.processCreativeBrief(brief, correlationId);
  }
}
