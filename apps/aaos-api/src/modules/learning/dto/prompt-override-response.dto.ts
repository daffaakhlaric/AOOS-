import type { PromptOverrideRow } from "../../prompt-override/infrastructure/prompt-override.repository.js";

/** `GET /api/v1/learning/prompt-overrides/:tenantId/active` real response shape (AAOS Self-Learning AI, Phase C) — camelCase mapping of the raw `agent_prompt_overrides` row, same convention as `learning-proposal-response.dto.ts`. */
export interface PromptOverrideResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly promptKey: string;
  readonly content: string;
  readonly version: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly deactivatedAt: string | null;
}

export function toPromptOverrideResponseDto(row: PromptOverrideRow): PromptOverrideResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    agent: row.agent,
    promptKey: row.prompt_key,
    content: row.content,
    version: row.version,
    isActive: row.is_active,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    deactivatedAt: row.deactivated_at,
  };
}
