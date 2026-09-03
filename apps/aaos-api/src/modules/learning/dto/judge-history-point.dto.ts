import type { JudgeResultRow } from "../../ai-judge/infrastructure/judge-result.repository.js";

/** `GET /api/v1/learning/judge-history` real response shape (AAOS Self-Improving, Phase SI-6 — the Learning Monitor's real Score Trend chart). One point per real `judge_results` row, oldest-first — a real, honest time series, never interpolated/fabricated between real judged runs. */
export interface JudgeHistoryPointDto {
  readonly createdAt: string;
  /** Real `scores.overall` — `null` (never `0`) when a row's `scores` JSONB has no real numeric `overall` (same honest-extraction discipline every other real consumer of this field already establishes). */
  readonly overall: number | null;
}

export function toJudgeHistoryPointDto(row: JudgeResultRow): JudgeHistoryPointDto {
  const overall = row.scores["overall"];
  return {
    createdAt: row.created_at,
    overall: typeof overall === "number" ? overall : null,
  };
}
