import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { Ad } from "../domain/entities/Ad.js";
import { AdSet, type AdSetProps } from "../domain/entities/AdSet.js";
import { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdSetId } from "../domain/value-objects/AdSetId.js";
import { AdStatus } from "../domain/value-objects/AdStatus.js";
import { Branch } from "../domain/value-objects/Branch.js";
import { Budget } from "../domain/value-objects/Budget.js";
import { CampaignId } from "../domain/value-objects/CampaignId.js";
import { Spend } from "../domain/value-objects/Spend.js";
import { StableId } from "../domain/value-objects/StableId.js";
import type { AudienceLabel } from "../utils/AudienceClassifier.js";

/** Builder Pattern class for constructing `AdSet` entities with sensible defaults — see `CampaignBuilder`'s docstring for the rationale. */
export class AdSetBuilder {
  private props: AdSetProps = {
    id: unwrapOrThrow(AdSetId.create("00000000-0000-4000-8000-000000000002")),
    stableId: unwrapOrThrow(StableId.create("B", 1)),
    metaId: "120000000000002",
    campaignId: unwrapOrThrow(CampaignId.create("00000000-0000-4000-8000-000000000001")),
    adAccountId: unwrapOrThrow(AdAccountId.create("act_752604553578354")),
    name: "Default AdSet",
    status: AdStatus.ACTIVE,
    dailyBudget: unwrapOrThrow(Budget.create(100_000)),
    branch: Branch.UMUM,
    spend: Spend.zero(),
    ads: [],
  };

  withId(id: AdSetId): this {
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

  withDailyBudget(dailyBudget: Budget): this {
    this.props = { ...this.props, dailyBudget };
    return this;
  }

  withBranch(branch: Branch): this {
    this.props = { ...this.props, branch };
    return this;
  }

  withSpend(spend: Spend): this {
    this.props = { ...this.props, spend };
    return this;
  }

  withAds(ads: ReadonlyArray<Ad>): this {
    this.props = { ...this.props, ads };
    return this;
  }

  withAudienceLabel(audienceLabel: AudienceLabel | undefined): this {
    this.props = { ...this.props, audienceLabel };
    return this;
  }

  build(): Result<AdSet, ValidationError> {
    return AdSet.create(this.props);
  }
}

function unwrapOrThrow<T>(result: Result<T, ValidationError>): T {
  // Unreachable in practice: every default literal above (fixed UUIDs, etc.) is valid by
  // construction. This guards only against a future edit introducing an invalid hardcoded default.
  /* v8 ignore next 3 */
  if (!result.ok) {
    throw new Error(`AdSetBuilder default construction failed: ${result.error.message}`);
  }
  return result.value;
}
