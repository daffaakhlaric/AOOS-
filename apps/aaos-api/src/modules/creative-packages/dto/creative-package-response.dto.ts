import type { StoredCreativePackage } from "../creative-package.store.js";

/** JSON-serializable projection of a `StoredCreativePackage` — already flat, but kept as a distinct DTO (mirrors `LeadResponseDto`'s convention) so the HTTP contract doesn't silently change shape if the store's internal type evolves. */
export interface CreativePackageResponseDto {
  readonly id: string;
  readonly briefId: string;
  readonly branch: string;
  readonly unit: string;
  readonly title: string;
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly {
    readonly id: string;
    readonly variantLabel: "A" | "B" | "C";
    readonly primaryText: string;
    readonly headline: string;
    readonly callToAction: string;
  }[];
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly selectedCopyVariantId?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
}

export function toCreativePackageResponseDto(
  pkg: StoredCreativePackage,
): CreativePackageResponseDto {
  return { ...pkg };
}
