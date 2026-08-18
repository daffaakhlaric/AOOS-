import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { ScrapedKilometer } from "../value-objects/ScrapedKilometer.js";
import type { ScrapedPrice } from "../value-objects/ScrapedPrice.js";
import type { ScrapeTimestamp } from "../value-objects/ScrapeTimestamp.js";
import type { UnitUrl } from "../value-objects/UnitUrl.js";

export type Transmission = "AT" | "MT";

export interface ScrapedUnitProps {
  readonly url: UnitUrl;
  readonly model: string;
  readonly brand: string;
  readonly year: number;
  readonly transmission: Transmission;
  readonly color: string;
  readonly kilometer: ScrapedKilometer;
  readonly price: ScrapedPrice;
  readonly branch: Branch;
  readonly photos: ReadonlyArray<string>;
  readonly available: boolean;
  readonly scrapedAt: ScrapeTimestamp;
}

/** A single used-car unit scraped from a mobixbydss.id listing/detail page. */
export class ScrapedUnit {
  private constructor(private readonly props: ScrapedUnitProps) {}

  static create(props: ScrapedUnitProps): Result<ScrapedUnit, ValidationError> {
    if (typeof props.model !== "string" || props.model.trim().length === 0) {
      return err(new ValidationError("ScrapedUnit.model must be a non-empty string"));
    }
    if (typeof props.brand !== "string" || props.brand.trim().length === 0) {
      return err(new ValidationError("ScrapedUnit.brand must be a non-empty string"));
    }
    if (!Number.isInteger(props.year) || props.year < 1990 || props.year > 2100) {
      return err(
        new ValidationError(
          `ScrapedUnit.year must be a plausible integer year, received: ${String(props.year)}`,
        ),
      );
    }
    if (props.transmission !== "AT" && props.transmission !== "MT") {
      return err(new ValidationError('ScrapedUnit.transmission must be "AT" or "MT"'));
    }
    return ok(new ScrapedUnit({ ...props, photos: [...props.photos] }));
  }

  get url(): UnitUrl {
    return this.props.url;
  }

  get model(): string {
    return this.props.model;
  }

  get brand(): string {
    return this.props.brand;
  }

  get year(): number {
    return this.props.year;
  }

  get transmission(): Transmission {
    return this.props.transmission;
  }

  get color(): string {
    return this.props.color;
  }

  get kilometer(): ScrapedKilometer {
    return this.props.kilometer;
  }

  get price(): ScrapedPrice {
    return this.props.price;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get photos(): ReadonlyArray<string> {
    return this.props.photos;
  }

  get available(): boolean {
    return this.props.available;
  }

  get scrapedAt(): ScrapeTimestamp {
    return this.props.scrapedAt;
  }

  /** Stable per-unit identity key — the detail-page URL slug, used to diff scrape sessions. */
  get identityKey(): string {
    return this.props.url.slug;
  }

  /**
   * A copy of this unit carrying a different photo set — used to replace the listing's single
   * thumbnail with the unit's FULL gallery once `IUnitDetailFetcher` has fetched it, so the photos
   * that get downloaded AND the photos that get persisted are the same complete set. Returns a new
   * instance; `ScrapedUnit` stays immutable.
   */
  withPhotos(photos: ReadonlyArray<string>): ScrapedUnit {
    return new ScrapedUnit({ ...this.props, photos: [...photos] });
  }

  matchesModel(query: string): boolean {
    return this.props.model.toLowerCase().includes(query.toLowerCase());
  }
}
