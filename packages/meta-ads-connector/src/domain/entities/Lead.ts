import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AdAccountId } from "../value-objects/AdAccountId.js";
import type { AdId } from "../value-objects/AdId.js";
import type { AdSetId } from "../value-objects/AdSetId.js";
import type { CampaignId } from "../value-objects/CampaignId.js";
import type { LeadId } from "../value-objects/LeadId.js";
import { LeadType } from "../value-objects/LeadType.js";
import { PublisherPlatform } from "../value-objects/PublisherPlatform.js";

export interface LeadProps {
  readonly id: LeadId;
  readonly adId: AdId;
  readonly adSetId: AdSetId;
  readonly campaignId: CampaignId;
  readonly adAccountId: AdAccountId;
  readonly type: LeadType;
  readonly wabaId?: string;
  readonly phone?: string;
  readonly formFields?: Readonly<Record<string, string>>;
  readonly source: PublisherPlatform;
  readonly receivedAt: Date;
}

/** A lead parsed from a Meta webhook payload — either a CTWA (click-to-WhatsApp) or a Form lead. */
export class Lead {
  private constructor(private readonly props: LeadProps) {}

  static create(props: LeadProps): Result<Lead, ValidationError> {
    if (!Object.values(LeadType).includes(props.type)) {
      return err(
        new ValidationError(`Lead.type must be a valid LeadType, received: ${String(props.type)}`),
      );
    }
    if (!Object.values(PublisherPlatform).includes(props.source)) {
      return err(
        new ValidationError(
          `Lead.source must be a valid PublisherPlatform, received: ${String(props.source)}`,
        ),
      );
    }
    if (props.type === LeadType.CTWA && (!props.phone || props.phone.trim().length === 0)) {
      return err(new ValidationError("Lead.phone is required for CTWA leads"));
    }
    if (
      props.type === LeadType.FORM &&
      (!props.formFields || Object.keys(props.formFields).length === 0)
    ) {
      return err(
        new ValidationError("Lead.formFields is required and must be non-empty for FORM leads"),
      );
    }
    return ok(
      new Lead({ ...props, formFields: props.formFields ? { ...props.formFields } : undefined }),
    );
  }

  get id(): LeadId {
    return this.props.id;
  }

  get adId(): AdId {
    return this.props.adId;
  }

  get adSetId(): AdSetId {
    return this.props.adSetId;
  }

  get campaignId(): CampaignId {
    return this.props.campaignId;
  }

  get adAccountId(): AdAccountId {
    return this.props.adAccountId;
  }

  get type(): LeadType {
    return this.props.type;
  }

  get wabaId(): string | undefined {
    return this.props.wabaId;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get formFields(): Readonly<Record<string, string>> | undefined {
    return this.props.formFields;
  }

  get source(): PublisherPlatform {
    return this.props.source;
  }

  get receivedAt(): Date {
    return this.props.receivedAt;
  }
}
