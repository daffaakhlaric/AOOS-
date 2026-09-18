import { z } from "zod";

import type { AssetPerformanceResult } from "../domain/asset-performance.js";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `GET /api/v1/creative-memory/asset-performance` query — same `since`/`until` (`YYYY-MM-DD`, both
 * optional but only TOGETHER) discipline `angle-performance.dto.ts` already establishes, reused
 * verbatim here rather than a second, subtly-different schema.
 */
export const AssetPerformanceQuerySchema = z
  .object({
    since: z.string().regex(DATE_ONLY_PATTERN, "since must be YYYY-MM-DD").optional(),
    until: z.string().regex(DATE_ONLY_PATTERN, "until must be YYYY-MM-DD").optional(),
  })
  .refine((value) => (value.since === undefined) === (value.until === undefined), {
    message: "since and until must be given together, or both omitted for lifetime",
  });
export type AssetPerformanceQueryDto = z.infer<typeof AssetPerformanceQuerySchema>;

export interface AssetPerformanceResponseDto {
  readonly assets: readonly AssetPerformanceResult[];
}
