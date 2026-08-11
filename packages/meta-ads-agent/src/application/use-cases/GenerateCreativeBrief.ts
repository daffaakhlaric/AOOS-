import { err, ok, type Result } from "@aos/common";
import type { Ad, AdAccount } from "@aos/meta-ads-connector";

import type { ICreativeBriefGenerator } from "../../contracts/ICreativeBriefGenerator.js";
import type { AgentMemory } from "../../domain/entities/AgentMemory.js";
import type { CreativeBrief } from "../../domain/entities/CreativeBrief.js";
import type { DecisionError } from "../../domain/errors/index.js";
import type { MetaAdsAgentEvents } from "../../domain/events/MetaAdsAgentEvents.js";

export interface GenerateCreativeBriefInput {
  readonly ad: Ad;
  readonly adAccount: AdAccount;
  readonly tenantId: string;
  readonly correlationId: string;
  /** AAOS-W1D-S1S2 (S1+S2) — when supplied, `generate()` produces a memory-aware brief (historical angle ranking, real inventory price, active promos). Optional/additive. */
  readonly memory?: AgentMemory;
}

/** Briefs Kai (future `@aos/creative-agent`) for a REFRESH-verdict ad (spec: "GenerateCreativeBrief"). */
export class GenerateCreativeBrief {
  constructor(
    private readonly generator: ICreativeBriefGenerator,
    private readonly events: MetaAdsAgentEvents,
  ) {}

  async execute(input: GenerateCreativeBriefInput): Promise<Result<CreativeBrief, DecisionError>> {
    const result = this.generator.generate(input.ad, input.adAccount, input.memory);
    if (!result.ok) {
      return err(result.error);
    }
    await this.events.publishCreativeBriefGenerated({
      tenantId: input.tenantId,
      creativeBriefId: result.value.id.toString(),
      adId: result.value.adId,
      angle: result.value.angle,
      urgency: result.value.urgency,
      correlationId: input.correlationId,
      occurredAt: new Date(),
      version: "1.0",
    });
    return ok(result.value);
  }
}
