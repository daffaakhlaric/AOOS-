import type { CreativeLogEntry } from "../domain/creative-log.js";
import type {
  CreativePackageFatigueStatus,
  CreativePackageFormat,
  CreativePackageOrigin,
  CreativePackageStatus,
  CreativePackageUrgency,
  CreativePackageVertical,
  StoredCreativePackage,
} from "../domain/creative-package.js";

/**
 * JSON-serializable projection of a `StoredCreativePackage` — kept as a distinct DTO (mirrors
 * `LeadResponseDto`'s convention) so the HTTP contract doesn't silently change shape if the
 * persisted type evolves. `tenantId` is deliberately NOT exposed: it is a server-side scoping
 * concern, not something the dashboard should see or send back.
 */
export interface CreativePackageResponseDto {
  readonly id: string;
  readonly briefId: string;
  readonly adId?: string;
  readonly stableId?: string;
  readonly vertical: CreativePackageVertical;
  readonly listingId?: string;
  readonly branch?: string;
  readonly unit?: string;
  readonly unitModel?: string;
  readonly title: string;
  readonly angle: string;
  readonly targetPersona?: string;
  readonly reason: string;
  readonly requestedFormat: CreativePackageFormat;
  readonly decidedFormat?: CreativePackageFormat;
  readonly primaryMessage: string;
  readonly urgency: CreativePackageUrgency;
  readonly origin: CreativePackageOrigin;
  readonly status: CreativePackageStatus;
  /** `042_creative_packages_ai_recommended.sql` — real record of whether this brief's angle was an accepted Kai recommendation (`kaiRecommendations.ts`). Only ever `true` for a `PROPERTY` package today. */
  readonly aiRecommended: boolean;
  /** `044_creative_packages_fatigue.sql` — real, scheduler-computed fatigue status (see `scheduler/domain/fatigue.ts`'s own doc for the honest FATIGUED-vs-WARNING degrade). */
  readonly fatigueStatus: CreativePackageFatigueStatus;
  readonly sourcePhotoUrls: readonly string[];
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly {
    readonly id: string;
    readonly variantLabel: "A" | "B" | "C";
    readonly primaryText: string;
    readonly headline: string;
    readonly callToAction: string;
  }[];
  readonly aiModel?: string;
  readonly confidenceScore?: number;
  readonly generationMs?: number;
  readonly selectedCopyVariantId?: string;
  readonly errorMessage?: string;
  readonly generatedAt?: string;
  readonly reviewedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** `GET /api/v1/creative-packages/:id` — the package plus its real, already-persisted event log. */
export interface CreativePackageDetailResponseDto {
  readonly package: CreativePackageResponseDto;
  readonly logs: readonly CreativeLogResponseDto[];
}

export interface CreativeLogResponseDto {
  readonly id: string;
  readonly packageId?: string;
  readonly fromAgent: string;
  readonly toAgent?: string;
  readonly eventType: string;
  readonly message: string;
  readonly brief?: unknown;
  readonly result?: unknown;
  readonly error?: string;
  readonly metadata?: unknown;
  readonly adId?: string;
  readonly stableId?: string;
  readonly createdAt: string;
}

export function toCreativePackageResponseDto(
  pkg: StoredCreativePackage,
): CreativePackageResponseDto {
  const { tenantId: _tenantId, ...rest } = pkg;
  return rest;
}

export function toCreativeLogResponseDto(entry: CreativeLogEntry): CreativeLogResponseDto {
  const { tenantId: _tenantId, ...rest } = entry;
  return rest;
}
