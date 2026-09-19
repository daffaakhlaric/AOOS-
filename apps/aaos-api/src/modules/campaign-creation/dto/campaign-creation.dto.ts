import type { CampaignBlueprint } from "../domain/campaign-blueprint.js";
import type { CampaignPreflightResult } from "../domain/campaign-preflight.js";
import type { ListingReadinessResult } from "../domain/listing-readiness.js";
import type { PortfolioPlanResult } from "../domain/portfolio-plan.js";

/**
 * `GET /api/v1/campaign-creation/listings/:listingId/readiness` response — PROMPT 33. Thin wrapper
 * around the real `ListingReadinessResult`, same "domain result IS the response shape" pattern
 * `PacingResponseDto` already establishes for `growth-objectives`.
 */
export interface ListingReadinessResponseDto {
  readonly listingId: string;
  readonly readiness: ListingReadinessResult;
}

/** `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/blueprint` response — PROMPT 32. */
export interface CampaignBlueprintResponseDto {
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly blueprint: CampaignBlueprint;
}

/** `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/preflight` response — PROMPT 35. */
export interface CampaignPreflightResponseDto {
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly preflight: CampaignPreflightResult;
}

/**
 * `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/portfolio-plan` response —
 * EYVRA SAMANTHA V2 Phase 32 (Portfolio Planner / Listing Allocation Engine). Thin wrapper around
 * the real `PortfolioPlanResult`, same "domain result IS the response shape" pattern
 * `ListingReadinessResponseDto`/`CampaignBlueprintResponseDto` already establish for this module.
 */
export interface PortfolioPlanResponseDto {
  readonly growthObjectiveId: string;
  readonly plan: PortfolioPlanResult;
}

/**
 * `POST /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/create`
 * response — EYVRA SAMANTHA V2 Phase 26 (PROMPT 36 — Safe Campaign Creation, PROMPT 37 —
 * Idempotency). One flat, honestly-distinguished outcome — see
 * `CampaignCreationService.createCampaign`'s own doc for exactly when each status is returned:
 *
 * - `BLOCKED` — server-side preflight (re-derived, never trusting a client-supplied flag) is not
 *   `ready`. No Meta call was made. `preflight` carries the real blocking reasons.
 * - `CONFLICT` — an idempotency row for this exact (growthObjectiveId, listingId) is `PENDING`
 *   (another request already in flight, or a crashed prior attempt). No Meta call was made.
 * - `DUPLICATE` — a real campaign already exists for this exact key (`CREATED` or
 *   `PARTIAL_FAILURE`). No new Meta call was made; `metaCampaignId`/`metaAdSetId` are the
 *   PREVIOUSLY created real ids.
 * - `SIMULATED` — the tenant is in DEV mode (`ModeGuardService`) — zero real Meta calls were made.
 * - `CREATED` — a real, PAUSED Campaign + AdSet were just created on Meta.
 * - `PARTIAL_FAILURE` — a real, PAUSED Campaign was created but AdSet creation failed. The
 *   Campaign is real and inert (PAUSED) — `metaCampaignId` is set, `metaAdSetId` is not. Not
 *   auto-retried this phase.
 * - `FAILED` — nothing was created on Meta (e.g. campaign creation itself failed, or the tenant's
 *   Meta connector could not be resolved).
 */
export type CampaignCreationOutcomeStatus =
  "BLOCKED" | "CONFLICT" | "DUPLICATE" | "SIMULATED" | "CREATED" | "PARTIAL_FAILURE" | "FAILED";

export interface CampaignCreationResponseDto {
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly status: CampaignCreationOutcomeStatus;
  /** Human-readable (Indonesian), specific — always present. */
  readonly message: string;
  readonly creationRequestId?: string;
  readonly blueprintId?: string;
  readonly metaCampaignId?: string;
  readonly metaAdSetId?: string;
  /** Present only for `status === "BLOCKED"`. */
  readonly preflight?: CampaignPreflightResult;
}
