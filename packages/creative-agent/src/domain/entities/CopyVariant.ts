import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { AdAngle } from "@aos/meta-ads-agent";

/** Meta Ads' own character limits (spec "Copy Builder (Indonesian)" — "All primaryText ≤ 125 chars (Meta Ads limit)" / "All headline ≤ 40 chars (Meta Ads limit)"). Enforced HERE, in the entity's own constructor, not merely by `CopyBuilder`'s convention — per the mission brief's instruction to "validate this in the `CopyVariant` domain entity itself". */
export const PRIMARY_TEXT_MAX_LENGTH = 125;
export const HEADLINE_MAX_LENGTH = 40;

export interface CopyVariantProps {
  readonly id: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly angle: AdAngle;
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

/** One of the 3 ad copy options (A/B/C) `CopyBuilder` produces for DSS to choose between (spec "Domain Models → CopyVariant"). Immutable — validated once at construction, never mutated. */
export class CopyVariant {
  private constructor(private readonly props: CopyVariantProps) {}

  static create(props: CopyVariantProps): Result<CopyVariant, ValidationError> {
    if (typeof props.id !== "string" || props.id.trim().length === 0) {
      return err(new ValidationError("CopyVariant.id must be a non-empty string"));
    }
    if (typeof props.primaryText !== "string" || props.primaryText.trim().length === 0) {
      return err(new ValidationError("CopyVariant.primaryText must be a non-empty string"));
    }
    if (props.primaryText.length > PRIMARY_TEXT_MAX_LENGTH) {
      return err(
        new ValidationError(
          `CopyVariant.primaryText must be <= ${PRIMARY_TEXT_MAX_LENGTH} chars (Meta Ads limit), received ${props.primaryText.length} chars`,
        ),
      );
    }
    if (typeof props.headline !== "string" || props.headline.trim().length === 0) {
      return err(new ValidationError("CopyVariant.headline must be a non-empty string"));
    }
    if (props.headline.length > HEADLINE_MAX_LENGTH) {
      return err(
        new ValidationError(
          `CopyVariant.headline must be <= ${HEADLINE_MAX_LENGTH} chars (Meta Ads limit), received ${props.headline.length} chars`,
        ),
      );
    }
    if (typeof props.callToAction !== "string" || props.callToAction.trim().length === 0) {
      return err(new ValidationError("CopyVariant.callToAction must be a non-empty string"));
    }
    return ok(new CopyVariant(props));
  }

  get id(): string {
    return this.props.id;
  }

  get variantLabel(): "A" | "B" | "C" {
    return this.props.variantLabel;
  }

  get angle(): AdAngle {
    return this.props.angle;
  }

  get primaryText(): string {
    return this.props.primaryText;
  }

  get headline(): string {
    return this.props.headline;
  }

  get callToAction(): string {
    return this.props.callToAction;
  }
}
