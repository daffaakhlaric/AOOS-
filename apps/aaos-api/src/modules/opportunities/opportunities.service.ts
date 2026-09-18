import { Injectable } from "@nestjs/common";

import { CampaignHealthService } from "../campaign-health/campaign-health.service.js";
import { CreativeMemoryService } from "../creative-memory/creative-memory.service.js";

import {
  detectCreativeWinnerOpportunities,
  detectScalingOpportunity,
  type Opportunity,
} from "./domain/opportunity.js";
import {
  toOpportunitiesResponseDto,
  type OpportunitiesResponseDto,
} from "./dto/opportunities-response.dto.js";

/**
 * `modules/opportunities` (EYVRA — SAMANTHA V2 Phase 9, Opportunity Engine). Orchestrates: real
 * `CampaignHealthService.assess` (Phase 3/4/6) + real `CreativeMemoryService.getAnglePerformance`
 * (Phase 2) -> the two pure detectors in `domain/opportunity.ts` -> one merged, real
 * `readonly Opportunity[]` list. Zero I/O of its own beyond those two injected services — see
 * `opportunity.ts`'s own header doc for the honest scope limit on which opportunity types this
 * module can support today.
 *
 * RE-COMPUTES BOTH INPUTS FRESH ON EVERY CALL — no new caching/persistence this phase. This is an
 * accepted MVP-scale tradeoff, same "N+1 is fine at today's real scale" tone
 * `creative-memory.repository.ts`'s own doc already establishes for its own per-package loop: a
 * caller invoking `detect()` triggers the SAME real Meta-insights snapshot fetches
 * `CampaignHealthService.assess` and `CreativeMemoryService.getAnglePerformance` would trigger on
 * their own, rather than reusing Phase 6's persisted `samantha_campaign_assessments` history. Reusing
 * that persisted history would introduce a staleness question ("is the persisted assessment still
 * current enough to base a real opportunity claim on?") this phase deliberately does not need to
 * solve yet — a real, separately-scoped tradeoff for a future phase, not a shortcut taken carelessly.
 */
@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly campaignHealthService: CampaignHealthService,
    private readonly creativeMemoryService: CreativeMemoryService,
  ) {}

  async detect(tenantId: string, metaCampaignId: string): Promise<OpportunitiesResponseDto> {
    const [healthResponse, angleResponse] = await Promise.all([
      this.campaignHealthService.assess(tenantId, metaCampaignId),
      this.creativeMemoryService.getAnglePerformance(tenantId),
    ]);

    const scalingOpportunity = detectScalingOpportunity(metaCampaignId, healthResponse.decision);
    const creativeWinnerOpportunities = detectCreativeWinnerOpportunities(angleResponse.angles);

    const opportunities: Opportunity[] = [
      ...(scalingOpportunity === undefined ? [] : [scalingOpportunity]),
      ...creativeWinnerOpportunities,
    ];

    return toOpportunitiesResponseDto(metaCampaignId, opportunities);
  }
}
