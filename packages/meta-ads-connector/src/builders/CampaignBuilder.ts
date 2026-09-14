import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { AdSet } from "../domain/entities/AdSet.js";
import { Campaign, type CampaignProps } from "../domain/entities/Campaign.js";
import { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdStatus } from "../domain/value-objects/AdStatus.js";
import { Branch } from "../domain/value-objects/Branch.js";
import { Budget } from "../domain/value-objects/Budget.js";
import { CampaignId } from "../domain/value-objects/CampaignId.js";
import { CampaignObjective } from "../domain/value-objects/CampaignObjective.js";
import { Funnel } from "../domain/value-objects/Funnel.js";
import { Spend } from "../domain/value-objects/Spend.js";
import { StableId } from "../domain/value-objects/StableId.js";

/**
 * Builder Pattern class for constructing `Campaign` entities with sensible defaults — used both
 * by production composition (e.g. a future `apps/aaos-api` seeding a fixture account) and by
 * this package's own tests, to build fixture Campaigns fluently instead of hand-assembling every
 * Value Object at every call site.
 */
export class CampaignBuilder {
  private props: CampaignProps = {
    id: unwrapOrThrow(CampaignId.create("00000000-0000-4000-8000-000000000001")),
    stableId: unwrapOrThrow(StableId.create("A", 1)),
    metaId: "120000000000001",
    adAccountId: unwrapOrThrow(AdAccountId.create("act_752604553578354")),
    name: "Default Campaign",
    objective: CampaignObjective.OUTCOME_ENGAGEMENT,
    status: AdStatus.ACTIVE,
    funnel: Funnel.BRAND_BOOST,
    branch: Branch.UMUM,
    spend: Spend.zero(),
    dailyBudget: unwrapOrThrow(Budget.create(0)),
    adSets: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  withId(id: CampaignId): this {
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

  withAdAccountId(adAccountId: AdAccountId): this {
    this.props = { ...this.props, adAccountId };
    return this;
  }

  withName(name: string): this {
    this.props = { ...this.props, name };
    return this;
  }

  withObjective(objective: CampaignObjective): this {
    this.props = { ...this.props, objective };
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

  withSpend(spend: Spend): this {
    this.props = { ...this.props, spend };
    return this;
  }

  withDailyBudget(dailyBudget: Budget): this {
    this.props = { ...this.props, dailyBudget };
    return this;
  }

  withAdSets(adSets: ReadonlyArray<AdSet>): this {
    this.props = { ...this.props, adSets };
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.props = { ...this.props, createdAt };
    return this;
  }

  build(): Result<Campaign, ValidationError> {
    return Campaign.create(this.props);
  }
}

function unwrapOrThrow<T>(result: Result<T, ValidationError>): T {
  // Unreachable in practice: every default literal above (fixed UUIDs, etc.) is valid by
  // construction. This guards only against a future edit introducing an invalid hardcoded default.
  /* v8 ignore next 3 */
  if (!result.ok) {
    throw new Error(`CampaignBuilder default construction failed: ${result.error.message}`);
  }
  return result.value;
}
