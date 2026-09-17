import { z } from "zod";

import type { AnglePerformanceResult } from "../domain/angle-performance.js";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `GET /api/v1/creative-memory/angle-performance` query — `since`/`until` are `YYYY-MM-DD`, both
 * optional but only TOGETHER (lifetime, no date filter, when both are omitted) — a lone `since` or
 * a lone `until` is rejected rather than silently treated as an open-ended range, same "never
 * silently reinterpret a partial input" discipline `MetricSnapshotQuerySchema`'s own doc follows
 * for its window default.
 */
export const AnglePerformanceQuerySchema = z
  .object({
    since: z.string().regex(DATE_ONLY_PATTERN, "since must be YYYY-MM-DD").optional(),
    until: z.string().regex(DATE_ONLY_PATTERN, "until must be YYYY-MM-DD").optional(),
  })
  .refine((value) => (value.since === undefined) === (value.until === undefined), {
    message: "since and until must be given together, or both omitted for lifetime",
  });
export type AnglePerformanceQueryDto = z.infer<typeof AnglePerformanceQuerySchema>;

export interface AnglePerformanceResponseDto {
  readonly angles: readonly AnglePerformanceResult[];
}
