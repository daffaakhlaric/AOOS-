import { z } from "zod";

import type { AgentConfigRow } from "../../agent-config/infrastructure/agent-config.repository.js";

/** `GET /api/v1/learning/configs` real response shape (AAOS Self-Improving, Phase SI-6 — the Learning Monitor's real `agent_configs` Config editor) — camelCase mapping of the raw row, same `toXResponseDto(row)` convention every other real list endpoint in this app already establishes. */
export interface AgentConfigResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly configKey: string;
  readonly value: string;
  readonly dataType: string;
  readonly description: string | null;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

export function toAgentConfigResponseDto(row: AgentConfigRow): AgentConfigResponseDto {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    agent: row.agent,
    configKey: row.config_key,
    value: row.value,
    dataType: row.data_type,
    description: row.description,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/**
 * `PUT /api/v1/learning/configs` body — a real, human Config editor write
 * (`AgentConfigService.set`, the SAME real upsert `ConfigApplierService.applyConfigUpdate`'s
 * auto-apply path already uses — one real write path, not a second one for the human editor).
 * `value` is a real finite number — `AgentConfigService.get`'s own doc documents why this table's
 * `value` column is free TEXT (defensive against a malformed stored value), but a human WRITE
 * through this editor is validated as a real number up front, never persisting a value this same
 * table's own real readers would silently reject.
 */
export const SetAgentConfigBodySchema = z.object({
  agent: z.string().min(1),
  configKey: z.string().min(1),
  value: z.number().finite(),
  updatedBy: z.string().min(1).optional(),
});
export type SetAgentConfigBodyDto = z.infer<typeof SetAgentConfigBodySchema>;
