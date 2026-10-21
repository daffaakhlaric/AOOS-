import type { StoredStressTestRun } from "../domain/stress-test-run.js";

export interface StressTestRunResponseDto {
  readonly id: string;
  readonly name: string;
  readonly sourceType: string;
  readonly listingId?: string;
  readonly campaignId?: string;
  readonly campaignDraftId?: string;
  readonly creativeIds: readonly string[];
  readonly mode: string;
  readonly primaryGoal: string;
  readonly personaIds: readonly string[];
  readonly objectionSources: readonly string[];
  readonly status: string;
  readonly result: StoredStressTestRun["result"];
  readonly failedReason?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
}

export function toStressTestRunResponseDto(run: StoredStressTestRun): StressTestRunResponseDto {
  return {
    id: run.id,
    name: run.name,
    sourceType: run.sourceType,
    ...(run.listingId !== undefined ? { listingId: run.listingId } : {}),
    ...(run.campaignId !== undefined ? { campaignId: run.campaignId } : {}),
    ...(run.campaignDraftId !== undefined ? { campaignDraftId: run.campaignDraftId } : {}),
    creativeIds: run.creativeIds,
    mode: run.mode,
    primaryGoal: run.primaryGoal,
    personaIds: run.personaIds,
    objectionSources: run.objectionSources,
    status: run.status,
    result: run.result,
    ...(run.failedReason !== undefined ? { failedReason: run.failedReason } : {}),
    createdAt: run.createdAt,
    ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
  };
}
