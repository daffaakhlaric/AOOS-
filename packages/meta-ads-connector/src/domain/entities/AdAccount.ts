import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AdAccountId } from "../value-objects/AdAccountId.js";

import type { Campaign } from "./Campaign.js";

export interface AdAccountProps {
  readonly id: AdAccountId;
  readonly name: string;
  readonly businessManagerId: string;
  readonly currency: "IDR";
  readonly timezone: "Asia/Jakarta";
  readonly campaigns: ReadonlyArray<Campaign>;
  readonly syncedAt: Date;
}

/** The aggregate root of a single sync snapshot — one Meta ad account and its full campaign hierarchy. */
export class AdAccount {
  private constructor(private readonly props: AdAccountProps) {}

  static create(props: AdAccountProps): Result<AdAccount, ValidationError> {
    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      return err(new ValidationError("AdAccount.name must be a non-empty string"));
    }
    if (
      typeof props.businessManagerId !== "string" ||
      props.businessManagerId.trim().length === 0
    ) {
      return err(new ValidationError("AdAccount.businessManagerId must be a non-empty string"));
    }
    if (props.currency !== "IDR") {
      return err(
        new ValidationError(
          `AdAccount.currency must be "IDR", received: ${String(props.currency)}`,
        ),
      );
    }
    if (props.timezone !== "Asia/Jakarta") {
      return err(
        new ValidationError(
          `AdAccount.timezone must be "Asia/Jakarta", received: ${String(props.timezone)}`,
        ),
      );
    }
    return ok(new AdAccount({ ...props, campaigns: [...props.campaigns] }));
  }

  get id(): AdAccountId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get businessManagerId(): string {
    return this.props.businessManagerId;
  }

  get currency(): "IDR" {
    return this.props.currency;
  }

  get timezone(): "Asia/Jakarta" {
    return this.props.timezone;
  }

  get campaigns(): ReadonlyArray<Campaign> {
    return this.props.campaigns;
  }

  get syncedAt(): Date {
    return this.props.syncedAt;
  }

  withCampaigns(campaigns: ReadonlyArray<Campaign>): AdAccount {
    return new AdAccount({ ...this.props, campaigns: [...campaigns] });
  }
}
