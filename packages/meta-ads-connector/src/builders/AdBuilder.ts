import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { Ad, type AdProps } from "../domain/entities/Ad.js";
import { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdId } from "../domain/value-objects/AdId.js";
import { AdMetrics } from "../domain/value-objects/AdMetrics.js";
import { AdSetId } from "../domain/value-objects/AdSetId.js";
import { AdStatus } from "../domain/value-objects/AdStatus.js";
import { Branch } from "../domain/value-objects/Branch.js";
import { CampaignId } from "../domain/value-objects/CampaignId.js";
import { Funnel } from "../domain/value-objects/Funnel.js";
import { Spend } from "../domain/value-objects/Spend.js";
import { StableId } from "../domain/value-objects/StableId.js";
import { Verdict } from "../domain/value-objects/Verdict.js";

/** Builder Pattern class for constructing `Ad` entities with sensible defaults — see `CampaignBuilder`'s docstring for the rationale. */
export class AdBuilder {
  private props: AdProps = {
    id: unwrapOrThrow(AdId.create("00000000-0000-4000-8000-000000000003")),
    stableId: unwrapOrThrow(StableId.create("C", 1)),
    metaId: "120000000000003",
    adSetId: unwrapOrThrow(AdSetId.create("00000000-0000-4000-8000-000000000002")),
    campaignId: unwrapOrThrow(CampaignId.create("00000000-0000-4000-8000-000000000001")),
    adAccountId: unwrapOrThrow(AdAccountId.create("act_752604553578354")),
    name: "Default Ad",
    status: AdStatus.ACTIVE,
    funnel: Funnel.BRAND_BOOST,
    branch: Branch.UMUM,
    metrics: unwrapOrThrow(
      AdMetrics.create({
        spend: Spend.zero(),
        impressions: 0,
        reach: 0,
        clicks: 0,
        conversations: 0,
        d2: 0,
        d3: 0,
        d5: 0,
        leadForm: 0,
      }),
    ),
    verdict: Verdict.REVIEW,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    daysSinceCreation: 0,
  };

  withId(id: AdId): this {
    this.props = { ...this.props, id };
    return this;
  }

  withStableId(stableId: StableId): this {
    this.props = { ...this.props, stableId };
    return this;
  }

  withMetaId(metaId: string): this {
    this.props = { ...this.props, metaId };
    return this;
  }

  withAdSetId(adSetId: AdSetId): this {
    this.props = { ...this.props, adSetId };
    return this;
  }

  withCampaignId(campaignId: CampaignId): this {
    this.props = { ...this.props, campaignId };
    return this;
  }

  withAdAccountId(adAccountId: AdAccountId): this {
    this.props = { ...this.props, adAccountId };
    return this;
  }

  withName(name: string): this {
    this.props = { ...this.props, name };
    return this;
  }

  withStatus(status: AdStatus): this {
    this.props = { ...this.props, status };
    return this;
  }

  withFunnel(funnel: Funnel): this {
    this.props = { ...this.props, funnel };
    return this;
  }

  withBranch(branch: Branch): this {
    this.props = { ...this.props, branch };
    return this;
  }

  withMetrics(metrics: AdMetrics): this {
    this.props = { ...this.props, metrics };
    return this;
  }

  withVerdict(verdict: Verdict): this {
    this.props = { ...this.props, verdict };
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.props = { ...this.props, createdAt };
    return this;
  }

  withDaysSinceCreation(daysSinceCreation: number): this {
    this.props = { ...this.props, daysSinceCreation };
    return this;
  }

  build(): Result<Ad, ValidationError> {
    return Ad.create(this.props);
  }
}

function unwrapOrThrow<T>(result: Result<T, ValidationError>): T {
  // Unreachable in practice: every default literal above (fixed UUIDs, etc.) is valid by
  // construction. This guards only against a future edit introducing an invalid hardcoded default.
  /* v8 ignore next 3 */
  if (!result.ok) {
    throw new Error(`AdBuilder default construction failed: ${result.error.message}`);
  }
  return result.value;
}
