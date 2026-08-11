import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { ScrapedUnit } from "./ScrapedUnit.js";

export interface ScrapeSessionProps {
  readonly sessionId: string;
  readonly units: ReadonlyArray<ScrapedUnit>;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly sourceUrl: string;
}

/** One completed scrape run over mobixbydss.id — the unit of comparison for `DetectInventoryChanges`. */
export class ScrapeSession {
  private constructor(private readonly props: ScrapeSessionProps) {}

  static create(props: ScrapeSessionProps): Result<ScrapeSession, ValidationError> {
    if (typeof props.sessionId !== "string" || props.sessionId.trim().length === 0) {
      return err(new ValidationError("ScrapeSession.sessionId must be a non-empty string"));
    }
    if (props.completedAt.getTime() < props.startedAt.getTime()) {
      return err(new ValidationError("ScrapeSession.completedAt must not precede startedAt"));
    }
    return ok(new ScrapeSession({ ...props, units: [...props.units] }));
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get units(): ReadonlyArray<ScrapedUnit> {
    return this.props.units;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get completedAt(): Date {
    return this.props.completedAt;
  }

  get sourceUrl(): string {
    return this.props.sourceUrl;
  }

  get unitCount(): number {
    return this.props.units.length;
  }

  /** Map keyed by `ScrapedUnit.identityKey` (URL slug) — the diffing key `DetectInventoryChanges` uses. */
  byIdentityKey(): ReadonlyMap<string, ScrapedUnit> {
    return new Map(this.props.units.map((u) => [u.identityKey, u]));
  }
}
