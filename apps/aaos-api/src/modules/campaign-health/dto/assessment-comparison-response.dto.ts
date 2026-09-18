import type { AssessmentComparison } from "../domain/assessment-comparison.js";

/**
 * `GET /api/v1/campaign-health/:campaignId/compare-latest` response — a real, discriminated shape
 * (never a thrown error) for the legitimate "only one real checkpoint exists yet" state, mirroring
 * how `BenchmarkResult`'s `source: "NONE"` honestly signals "not enough data" rather than being
 * synthesized or thrown. `available: false` is returned when fewer than 2 real
 * `samantha_campaign_assessments` rows exist for this campaign yet (0 rows is a real `NotFoundError`
 * instead — see `CampaignHealthService.compareLatest`'s own doc for why that split is honest, not
 * arbitrary).
 */
export type AssessmentComparisonResponseDto =
  | {
      readonly available: false;
      readonly reason: string;
    }
  | {
      readonly available: true;
      readonly comparison: AssessmentComparison;
      readonly previousAssessedAt: string;
      readonly currentAssessedAt: string;
    };
