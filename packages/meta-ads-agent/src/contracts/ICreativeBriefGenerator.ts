import type { Result } from "@aos/common";
import type { Ad, AdAccount } from "@aos/meta-ads-connector";

import type { AgentMemory } from "../domain/entities/AgentMemory.js";
import type { CreativeBrief } from "../domain/entities/CreativeBrief.js";
import type { DecisionError } from "../domain/errors/index.js";

/** Port for generating a `CreativeBrief` for a REFRESH-verdict ad — implemented by `builders/CreativeBriefBuilder.ts`. `memory` is AAOS-W1D-S1S2 (S1+S2) — optional and additive; W1D-base callers that don't pass it get the original static-only brief. */
export interface ICreativeBriefGenerator {
  generate(
    ad: Ad,
    adAccount: AdAccount,
    memory?: AgentMemory,
  ): Result<CreativeBrief, DecisionError>;
}
