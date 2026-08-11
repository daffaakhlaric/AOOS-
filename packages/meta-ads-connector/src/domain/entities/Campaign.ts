import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AdAccountId } from "../value-objects/AdAccountId.js";
import { AdStatus } from "../value-objects/AdStatus.js";
import type { Branch } from "../value-objects/Branch.js";
import type { CampaignId } from "../value-objects/CampaignId.js";
import { CampaignObjective } from "../value-objects/CampaignObjective.js";
import type { Funnel } from "../value-objects/Funnel.js";
import type { Spend } from "../value-objects/Spend.js";
import type { StableId } from "../value-objects/StableId.js";

import type { AdSet } from "./AdSet.js";

export interface CampaignProps {
  readonly id: CampaignId;
  readonly stableId: StableId;
  readonly metaId: string;
  readonly adAccountId: AdAccountId;
  readonly name: string;
  readonly objective: CampaignObjective;
  readonly status: AdStatus;
  readonly funnel: Funnel;
  readonly branch: Branch;
  readonly spend: Spend;
  readonly adSets: ReadonlyArray<AdSet>;
  readonly createdAt: Date;
}

/** The `#A` entity — a Meta campaign, holding its ad sets. */
export class Campaign {
  private constructor(private readonly props: CampaignProps) {}

  static create(props: CampaignProps): Result<Campaign, ValidationError> {
    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      return err(new ValidationError("Campaign.name must be a non-empty string"));
    }
    if (typeof props.metaId !== "string" || props.metaId.trim().length === 0) {
      return err(new ValidationError("Campaign.metaId must be a non-empty string"));
    }
    if (!Object.values(CampaignObjective).includes(props.objective)) {
      return err(
        new ValidationError(
          `Campaign.objective must be a valid CampaignObjective, received: ${String(props.objective)}`,
        ),
      );
    }
    if (!Object.values(AdStatus).includes(props.status)) {
      return err(
        new ValidationError(
          `Campaign.status must be a valid AdStatus, received: ${String(props.status)}`,
        ),
      );
    }
    return ok(new Campaign({ ...props, adSets: [...props.adSets] }));
  }

  get id(): CampaignId {
    return this.props.id;
  }

  get stableId(): StableId {
    return this.props.stableId;
  }

  get metaId(): string {
    return this.props.metaId;
  }

  get adAccountId(): AdAccountId {
    return this.props.adAccountId;
  }

  get name(): string {
    return this.props.name;
  }

  get objective(): CampaignObjective {
    return this.props.objective;
  }

  get status(): AdStatus {
    return this.props.status;
  }

  get funnel(): Funnel {
    return this.props.funnel;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get spend(): Spend {
    return this.props.spend;
  }

  get adSets(): ReadonlyArray<AdSet> {
    return this.props.adSets;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  withAdSets(adSets: ReadonlyArray<AdSet>): Campaign {
    return new Campaign({ ...this.props, adSets: [...adSets] });
  }

  withStableId(stableId: StableId): Campaign {
    return new Campaign({ ...this.props, stableId });
  }

  withObjective(objective: CampaignObjective): Campaign {
    return new Campaign({ ...this.props, objective });
  }
}
