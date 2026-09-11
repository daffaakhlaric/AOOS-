import type { AssetDto } from "@/types/dashboard.types";

/**
 * CREATIVE HUB — the real, honest 2-way "source" classification (`GET /creative` grid, Prompt 3 of
 * the pasted "AUDIENCE HEATMAP + CREATIVE HUB" spec).
 *
 * The spec asks for 5 source tabs ("Meta"/"Uploaded"/"Imported"/…) — none of those buckets have any
 * real backing data anywhere in this codebase: `Asset` (`@aos/asset-library`) has no `source`
 * field, there is no Meta-creative-sync pipeline, and "Imported" is not a concept this domain has.
 * The ONLY real, honestly-derivable signal is whether `aiModel`/`creativeBriefId` is set —
 * populated EXCLUSIVELY by `SaveAiCreative`, Kai's real generation use case
 * (`packages/asset-library/src/application/use-cases/SaveAiCreative.ts`). `type` is NOT an
 * equivalent proxy: `UploadAsset` (the manual-upload path) can also persist `AI_IMAGE`/`AI_VIDEO`
 * with no `aiModel` set (see its own "manual" storage-path fallback), so a manually uploaded
 * "AI"-typed file would be mis-classified as Kai's work if this checked `type` instead.
 *
 * A pure function so the classification rule is independently unit-testable without rendering the
 * grid.
 */
export type AssetSource = "MANUAL" | "KAI";

export function classifyAssetSource(
  asset: Pick<AssetDto, "aiModel" | "creativeBriefId">,
): AssetSource {
  return asset.aiModel !== undefined || asset.creativeBriefId !== undefined ? "KAI" : "MANUAL";
}
