import { z } from "zod";

import type { ActivityRow, ActivityToolCallEntry } from "../infrastructure/activity.repository.js";

/** `GET /api/v1/activity-log` query — the dashboard Activity Log page's filter bar (design doc Phase B point 4). */
export const GetActivitiesQuerySchema = z.object({
  agent: z.string().min(1).optional(),
  status: z.enum(["RUNNING", "SUCCESS", "SIMULATED", "ERROR"]).optional(),
  mode: z.enum(["DEV", "LIVE"]).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
export type GetActivitiesQueryDto = z.infer<typeof GetActivitiesQuerySchema>;

export interface ActivityToolCallDto {
  readonly tool: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly at: string;
}

export interface ActivityResponseDto {
  readonly id: string;
  readonly loopId?: string;
  readonly agent: string;
  readonly actionType: string;
  readonly mode: string;
  readonly status: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly devPreview?: unknown;
  readonly reasoning?: string;
  readonly toolCalls: readonly ActivityToolCallDto[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly errorMessage?: string;
  readonly errorStack?: string;
  readonly createdAt: string;
}

export interface ActivityListResponseDto {
  readonly activities: readonly ActivityResponseDto[];
  readonly total: number;
}

function toToolCallDto(entry: ActivityToolCallEntry): ActivityToolCallDto {
  return { tool: entry.tool, input: entry.input, output: entry.output, at: entry.at };
}

export function toActivityResponseDto(row: ActivityRow): ActivityResponseDto {
  return {
    id: row.id,
    ...(row.loop_id !== null ? { loopId: row.loop_id } : {}),
    agent: row.agent,
    actionType: row.action_type,
    mode: row.mode,
    status: row.status,
    ...(row.input !== null ? { input: row.input } : {}),
    ...(row.output !== null ? { output: row.output } : {}),
    ...(row.dev_preview !== null ? { devPreview: row.dev_preview } : {}),
    ...(row.reasoning !== null ? { reasoning: row.reasoning } : {}),
    toolCalls: row.tool_calls.map(toToolCallDto),
    startedAt: row.started_at,
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    ...(row.error_stack !== null ? { errorStack: row.error_stack } : {}),
    createdAt: row.created_at,
  };
}
