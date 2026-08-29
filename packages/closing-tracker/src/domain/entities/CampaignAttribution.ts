import { BranchId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AttributionScore, ClosingRate, RphSpk } from "../value-objects/index.js";

export type ClosingVerdict = "SCALE" | "KEEP" | "PAUSE";

export interface VerdictThresholds {
  readonly rphSpkScaleThreshold: number;
  readonly rphSpkKeepThreshold: number;
  readonly minSpendForPause: number;
}

/**
 * **Coordinator note #2 resolution**: the spec defines a THIRD threshold (`rphSpkPauseThreshold`,
 * default `10_000_000`) but neither the verdict prose directly above `CampaignAttribution` in the
 * spec nor any pinned "Business correctness" test ever exercises a 4th band — both pinned examples
 * (`spend=10_000_000,spk=2→KEEP` and `spend=10_000_001,spk=2→PAUSE`) land at or barely past the
 * `keepThreshold` (5jt), nowhere near 10jt. This function implements the pinned two-boundary,
 * three-band system: `< scaleThreshold` → `SCALE`, `scaleThreshold <= x <= keepThreshold` →
 * `KEEP`, `> keepThreshold` → `PAUSE`. `rphSpkPauseThreshold`/`minSpendForPause` remain in
 * `ClosingTrackerConfig` as spec'd but `rphSpkPauseThreshold` is deliberately not read here — see
 * package report "Coordinator note #2".
 *
 * Zero-SPK campaigns with spend at or above `minSpendForPause` are always `PAUSE` regardless of
 * `rphSpk` (which is `0` for zero-SPK campaigns per `RphSpk.fromSpendAndSpk`'s divide-by-zero
 * guard, and `0 < scaleThreshold` would otherwise wrongly read as `SCALE`).
 */
export function resolveVerdict(
  rphSpkValue: number,
  totalSpk: number,
  totalSpend: number,
  thresholds: VerdictThresholds,
): ClosingVerdict {
  if (totalSpk === 0 && totalSpend >= thresholds.minSpendForPause) {
    return "PAUSE";
  }
  if (rphSpkValue < thresholds.rphSpkScaleThreshold) {
    return "SCALE";
  }
  if (rphSpkValue <= thresholds.rphSpkKeepThreshold) {
    return "KEEP";
  }
  return "PAUSE";
}

export interface CampaignAttributionProps {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly stableId: string;
  readonly adId?: string;
  readonly branch: BranchId;
  readonly totalSpend: number;
  readonly totalHotLeads: number;
  readonly totalTestDrives: number;
  readonly totalSpk: number;
  readonly totalCommissionIdr: number;
  readonly rphSpk: RphSpk;
  readonly rphLead: number;
  readonly closingRate: ClosingRate;
  readonly attributionScore: AttributionScore;
  readonly verdict: ClosingVerdict;
}

/** Closing performance attributed to one Meta campaign — the core Samantha feed-back unit (spec: "CampaignAttribution (Entity)"). */
export class CampaignAttribution {
  private constructor(private readonly props: CampaignAttributionProps) {}

  static create(props: CampaignAttributionProps): Result<CampaignAttribution, ValidationError> {
    if (typeof props.campaignId !== "string" || props.campaignId.trim().length === 0) {
      return err(new ValidationError("CampaignAttribution.campaignId must be a non-empty string"));
    }
    if (typeof props.campaignName !== "string" || props.campaignName.trim().length === 0) {
      return err(
        new ValidationError("CampaignAttribution.campaignName must be a non-empty string"),
      );
    }
    if (!Object.values(BranchId).includes(props.branch)) {
      return err(
        new ValidationError(
          `CampaignAttribution.branch must be a valid BranchId, received: ${String(props.branch)}`,
        ),
      );
    }
    for (const [field, value] of [
      ["totalSpend", props.totalSpend],
      ["totalHotLeads", props.totalHotLeads],
      ["totalTestDrives", props.totalTestDrives],
      ["totalSpk", props.totalSpk],
      ["totalCommissionIdr", props.totalCommissionIdr],
      ["rphLead", props.rphLead],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        return err(
          new ValidationError(
            `CampaignAttribution.${field} must be a non-negative finite number, received: ${String(value)}`,
          ),
        );
      }
    }
    if (!["SCALE", "KEEP", "PAUSE"].includes(props.verdict)) {
      return err(
        new ValidationError(
          `CampaignAttribution.verdict must be one of SCALE/KEEP/PAUSE, received: ${String(props.verdict)}`,
        ),
      );
    }
    return ok(new CampaignAttribution({ ...props }));
  }

  get campaignId(): string {
    return this.props.campaignId;
  }

  get campaignName(): string {
    return this.props.campaignName;
  }

  get stableId(): string {
    return this.props.stableId;
  }

  get adId(): string | undefined {
    return this.props.adId;
  }

  get branch(): BranchId {
    return this.props.branch;
  }

  get totalSpend(): number {
    return this.props.totalSpend;
  }

  get totalHotLeads(): number {
    return this.props.totalHotLeads;
  }

  get totalTestDrives(): number {
    return this.props.totalTestDrives;
  }

  get totalSpk(): number {
    return this.props.totalSpk;
  }

  get totalCommissionIdr(): number {
    return this.props.totalCommissionIdr;
  }

  get rphSpk(): RphSpk {
    return this.props.rphSpk;
  }

  get rphLead(): number {
    return this.props.rphLead;
  }

  get closingRate(): ClosingRate {
    return this.props.closingRate;
  }

  get attributionScore(): AttributionScore {
    return this.props.attributionScore;
  }

  get verdict(): ClosingVerdict {
    return this.props.verdict;
  }
}
