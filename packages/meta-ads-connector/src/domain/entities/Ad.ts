import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AdAccountId } from "../value-objects/AdAccountId.js";
import type { AdId } from "../value-objects/AdId.js";
import type { AdMetrics } from "../value-objects/AdMetrics.js";
import type { AdSetId } from "../value-objects/AdSetId.js";
import { AdStatus } from "../value-objects/AdStatus.js";
import type { Branch } from "../value-objects/Branch.js";
import type { CampaignId } from "../value-objects/CampaignId.js";
import type { CreativeAsset } from "../value-objects/CreativeAsset.js";
import type { Funnel } from "../value-objects/Funnel.js";
import type { StableId } from "../value-objects/StableId.js";
import { Verdict } from "../value-objects/Verdict.js";

export interface AdProps {
  readonly id: AdId;
  readonly stableId: StableId;
  readonly metaId: string;
  readonly adSetId: AdSetId;
  readonly campaignId: CampaignId;
  readonly adAccountId: AdAccountId;
  readonly name: string;
  readonly status: AdStatus;
  readonly funnel: Funnel;
  readonly branch: Branch;
  readonly metrics: AdMetrics;
  readonly verdict: Verdict;
  readonly createdAt: Date;
  readonly daysSinceCreation: number;
  /**
   * Optional key (not just an optional-valued required key) — every existing `AdProps` object
   * literal across this package (builders, mappers, tests) predates this field and must keep
   * compiling unchanged. `undefined`/omitted means Meta reported no creative asset id for this ad
   * — see `CreativeAsset`'s own docstring for when that happens.
   */
  readonly creativeAsset?: CreativeAsset;
  /**
   * AAOS Samantha Professional Optimizer, Part B — real, pulled ad-copy TEXT (as opposed to
   * `creativeAsset`'s image/video reference). Optional keys, same convention as `creativeAsset`:
   * every pre-existing `AdProps` object literal predates these fields and must keep compiling
   * unchanged. Each of the 3 is independently `undefined` when Meta's real creative for this ad
   * doesn't carry it in the one real shape this package covers (`object_story_spec.link_data` —
   * see `types/MetaApiTypes.ts`'s `MetaAdCreativeLinkDataSchema` docstring for the full real-shape
   * citation and which other real ad shapes are honestly NOT covered) — never a fabricated
   * placeholder standing in for text Meta didn't actually return.
   */
  readonly primaryText?: string;
  readonly headline?: string;
  readonly description?: string;
  /**
   * AAOS Samantha Professional Optimizer, Part A — the real, honest explanation for why
   * `VerdictEngine.evaluateVerdict`'s raw verdict was suppressed/changed by Learning Phase
   * awareness (see `domain/services/VerdictEngine.ts`'s `getVerdictReason`). `undefined` for the
   * overwhelming majority of ads (no suppression applied — the raw verdict stands as computed).
   */
  readonly verdictReason?: string;
}

/** The `#C` entity — a single Meta ad, carrying its computed metrics and VerdictEngine verdict. */
export class Ad {
  private constructor(private readonly props: AdProps) {}

  static create(props: AdProps): Result<Ad, ValidationError> {
    if (typeof props.name !== "string" || props.name.trim().length === 0) {
      return err(new ValidationError("Ad.name must be a non-empty string"));
    }
    if (typeof props.metaId !== "string" || props.metaId.trim().length === 0) {
      return err(new ValidationError("Ad.metaId must be a non-empty string"));
    }
    if (!Object.values(AdStatus).includes(props.status)) {
      return err(
        new ValidationError(
          `Ad.status must be a valid AdStatus, received: ${String(props.status)}`,
        ),
      );
    }
    if (!Object.values(Verdict).includes(props.verdict)) {
      return err(
        new ValidationError(
          `Ad.verdict must be a valid Verdict, received: ${String(props.verdict)}`,
        ),
      );
    }
    if (!Number.isFinite(props.daysSinceCreation) || props.daysSinceCreation < 0) {
      return err(
        new ValidationError(
          `Ad.daysSinceCreation must be a non-negative finite number, received: ${String(props.daysSinceCreation)}`,
        ),
      );
    }
    return ok(new Ad({ ...props }));
  }

  get id(): AdId {
    return this.props.id;
  }

  get stableId(): StableId {
    return this.props.stableId;
  }

  get metaId(): string {
    return this.props.metaId;
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

  get name(): string {
    return this.props.name;
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

  get metrics(): AdMetrics {
    return this.props.metrics;
  }

  get verdict(): Verdict {
    return this.props.verdict;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get daysSinceCreation(): number {
    return this.props.daysSinceCreation;
  }

  get creativeAsset(): CreativeAsset | undefined {
    return this.props.creativeAsset;
  }

  get primaryText(): string | undefined {
    return this.props.primaryText;
  }

  get headline(): string | undefined {
    return this.props.headline;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get verdictReason(): string | undefined {
    return this.props.verdictReason;
  }

  /** Returns a shallow-cloned Ad with a new verdict (and optional reason) — Ads are immutable, so this never mutates `this`. `reason` defaults to `undefined` — a plain `withVerdict(verdict)` call (every pre-existing call site) clears any previous reason, matching "no suppression applied" for that verdict. */
  withVerdict(verdict: Verdict, reason?: string): Ad {
    return new Ad({ ...this.props, verdict, verdictReason: reason });
  }

  /** Returns a shallow-cloned Ad with a new stableId, assigned by StableIdAssigner. */
  withStableId(stableId: StableId): Ad {
    return new Ad({ ...this.props, stableId });
  }
}
