import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ScrapeTimestamp } from "../value-objects/ScrapeTimestamp.js";

export interface ScrapedPromoProps {
  readonly title: string;
  readonly description: string;
  readonly validUntil?: Date;
  readonly appliesTo?: ReadonlyArray<string>;
  readonly scrapedAt: ScrapeTimestamp;
}

/** A single promo/campaign banner scraped from a mobixbydss.id promo page. */
export class ScrapedPromo {
  private constructor(private readonly props: ScrapedPromoProps) {}

  static create(props: ScrapedPromoProps): Result<ScrapedPromo, ValidationError> {
    if (typeof props.title !== "string" || props.title.trim().length === 0) {
      return err(new ValidationError("ScrapedPromo.title must be a non-empty string"));
    }
    if (typeof props.description !== "string") {
      return err(new ValidationError("ScrapedPromo.description must be a string"));
    }
    return ok(
      new ScrapedPromo({
        ...props,
        appliesTo: props.appliesTo ? [...props.appliesTo] : undefined,
      }),
    );
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get validUntil(): Date | undefined {
    return this.props.validUntil;
  }

  get appliesTo(): ReadonlyArray<string> | undefined {
    return this.props.appliesTo;
  }

  get scrapedAt(): ScrapeTimestamp {
    return this.props.scrapedAt;
  }

  /** True when unrestricted (no `appliesTo`) or when `unitModel` is explicitly listed. */
  appliesToUnit(unitModel: string): boolean {
    if (!this.props.appliesTo || this.props.appliesTo.length === 0) {
      return true;
    }
    return this.props.appliesTo.some((m) => m.toLowerCase() === unitModel.toLowerCase());
  }

  isActive(now: Date): boolean {
    return !this.props.validUntil || this.props.validUntil.getTime() >= now.getTime();
  }
}
