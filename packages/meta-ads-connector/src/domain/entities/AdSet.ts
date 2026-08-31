import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AudienceLabel } from "../../utils/AudienceClassifier.js";
import type { AdAccountId } from "../value-objects/AdAccountId.js";
import type { AdSetId } from "../value-objects/AdSetId.js";
import { AdStatus } from "../value-objects/AdStatus.js";
import type { Branch } from "../value-objects/Branch.js";
import type { Budget } from "../value-objects/Budget.js";
import type { CampaignId } from "../value-objects/CampaignId.js";
import type { Spend } from "../value-objects/Spend.js";
import type { StableId } from "../value-objects/StableId.js";

import type { Ad } from "./Ad.js";

export interface AdSetProps {
  readonly id: AdSetId;
  readonly stableId: StableId;
  readonly metaId: string;
  readonly campaignId: CampaignId;
  readonly adAccountId: AdAccountId;
  readonly name: string;
  readonly status: AdStatus;
  readonly dailyBudget: Budget;
  readonly branch: Branch;
  readonly spend: Spend;
  readonly ads: ReadonlyArray<Ad>;
  /**
   * AAOS Analytics Platform Phase 3 — `classifyAudience(targeting)` run against this ad set's
   * real pulled `targeting` spec (see `mappers/AdSetMapper.ts`). Optional key (not just an
   * optional-valued required key), mirroring `Ad.creativeAsset`'s exact Phase 2 convention: every
   * pre-existing `AdSetProps` object literal across this package (builders, mappers, tests)
   * predates this field and must keep compiling unchanged.
   */
  readonly audienceLabel?: AudienceLabel;
}

/** The `#B` entity — a Meta ad set, holding its ads. */
export class AdSet {
  private constructor(private readonly props: AdSetProps) {}

  static create(props: AdSetProps): Result<AdSet, ValidationError> {
    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      return err(new ValidationError("AdSet.name must be a non-empty string"));
    }
    if (typeof props.metaId !== "string" || props.metaId.trim().length === 0) {
      return err(new ValidationError("AdSet.metaId must be a non-empty string"));
    }
    if (!Object.values(AdStatus).includes(props.status)) {
      return err(
        new ValidationError(
          `AdSet.status must be a valid AdStatus, received: ${String(props.status)}`,
        ),
      );
    }
    return ok(new AdSet({ ...props, ads: [...props.ads] }));
  }

  get id(): AdSetId {
    return this.props.id;
  }

  get stableId(): StableId {
    return this.props.stableId;
  }

  get metaId(): string {
    return this.props.metaId;
  }

  get campaignId(): CampaignId {
    return this.props.campaignId;
  }

  get adAccountId(): AdAccountId {
    return this.props.adAccountId;
  }

  get name(): string {
    return this.props.name;
  }

  get status(): AdStatus {
    return this.props.status;
  }

  get dailyBudget(): Budget {
    return this.props.dailyBudget;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get spend(): Spend {
    return this.props.spend;
  }

  get ads(): ReadonlyArray<Ad> {
    return this.props.ads;
  }

  get audienceLabel(): AudienceLabel | undefined {
    return this.props.audienceLabel;
  }

  withAds(ads: ReadonlyArray<Ad>): AdSet {
    return new AdSet({ ...this.props, ads: [...ads] });
  }

  withStableId(stableId: StableId): AdSet {
    return new AdSet({ ...this.props, stableId });
  }

  withDailyBudget(dailyBudget: Budget): AdSet {
    return new AdSet({ ...this.props, dailyBudget });
  }
}
