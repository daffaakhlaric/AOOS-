/**
 * `CampaignsService.restructureCampaign` real input (Samantha Andromeda-Aware Campaign System,
 * Sprint 1) — NOT exposed as a public HTTP endpoint in this sprint (no controller route binds this
 * DTO): its ONLY real caller is `PendingActionsService.approve()`'s `RESTRUCTURE_CAMPAIGN` branch,
 * itself only reachable via a human's real Approve decision on an already-enqueued
 * `pending_agent_actions` row. Field names mirror that row's own real `payload` shape
 * (`SchedulerService.runAndromedaRestructureCheck`'s own doc) exactly, so `approve()` can pass the
 * stored payload straight through with no re-shaping.
 */
export interface RestructureCampaignRequest {
  readonly campaignId: string;
  /** The real ad set proposed to KEEP (budget consolidates onto this one) — see `runAndromedaRestructureCheck`'s own doc for the "highest real cumulative spend" judgment call this id was chosen by. */
  readonly proposedKeepAdSetId: string;
  /** Every other real ad set on this campaign — paused. */
  readonly proposedPauseAdSetIds: readonly string[];
}

/**
 * Same "always honest about DEV vs LIVE, never a fabricated id" discipline
 * `CreatePropertyCampaignResponseDto` already establishes. `pausedAdSetIds`/`failedAdSetIds` are
 * only present for a real (non-simulated) LIVE result — `RestructureCampaign`'s own real per-item
 * best-effort output, split by outcome. DEV mode makes zero real Meta calls (`note` explains why).
 */
export interface RestructureCampaignResponseDto {
  readonly campaignId: string;
  readonly simulated: boolean;
  readonly pausedAdSetIds?: readonly string[];
  readonly failedAdSetIds?: readonly string[];
  readonly note?: string;
}
