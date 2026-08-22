import type { StoredMetaAudience } from "../domain/meta-audience.js";

export interface MetaAudienceResponseDto {
  readonly id: string;
  readonly metaAudienceId: string;
  readonly audienceType: string;
  readonly name: string;
  readonly size?: number;
  readonly originAudienceId?: string;
  readonly percentage?: number;
  readonly status: string;
  readonly lastUpdatedAt?: string;
  readonly createdAt: string;
}

export function toMetaAudienceResponseDto(audience: StoredMetaAudience): MetaAudienceResponseDto {
  return {
    id: audience.id,
    metaAudienceId: audience.metaAudienceId,
    audienceType: audience.audienceType,
    name: audience.name,
    ...(audience.size !== undefined ? { size: audience.size } : {}),
    ...(audience.originAudienceId !== undefined
      ? { originAudienceId: audience.originAudienceId }
      : {}),
    ...(audience.percentage !== undefined ? { percentage: audience.percentage } : {}),
    status: audience.status,
    ...(audience.lastUpdatedAt !== undefined ? { lastUpdatedAt: audience.lastUpdatedAt } : {}),
    createdAt: audience.createdAt,
  };
}

/** `GET /api/v1/lookalike/status` — backs the spec's "Hot Leads Database" status card (47/100 progress bar). */
export interface LookalikeStatusResponseDto {
  readonly totalHotLeads: number;
  readonly syncedToMetaAudience: number;
  readonly minRequiredForLookalike: number;
  readonly progressPercentage: number;
  readonly lookalikeEligible: boolean;
  readonly lastSyncedAt?: string;
  readonly customAudience?: MetaAudienceResponseDto;
}

/** `POST /api/v1/lookalike/sync` — the "Sync Hot Leads ke Meta" button's response. */
export interface LookalikeSyncResponseDto {
  readonly summary: string;
  readonly newlySynced: number;
  readonly totalSynced: number;
  readonly customAudience?: MetaAudienceResponseDto;
}
