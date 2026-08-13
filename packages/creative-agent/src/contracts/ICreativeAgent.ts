import type { Result } from "@aos/common";
import type { CreativeBrief } from "@aos/meta-ads-agent";

import type { CreativePackage } from "../domain/entities/CreativePackage.js";
import type { CreativeAgentError } from "../domain/errors/CreativeAgentError.js";

/** Port (Hexagonal Architecture) for Kai's top-level responsibility (spec Mission). The only implementation is `application/services/KaiAgentService.ts`. */
export interface ICreativeAgent {
  processCreativeBrief(
    brief: CreativeBrief,
    correlationId?: string,
  ): Promise<Result<CreativePackage, CreativeAgentError>>;
}
