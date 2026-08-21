import { z } from "zod";

import type { BroadcastTemplateRow } from "../infrastructure/broadcast-template.repository.js";

const TargetStatusSchema = z.enum(["WARM", "COLD"]);
const TemplateStatusSchema = z.enum(["ACTIVE", "DRAFT", "INACTIVE"]);

/** `POST /api/v1/recycling/templates` body — the "Buat Template Broadcast" modal's payload. */
export const CreateTemplateBodySchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1).max(1000),
  targetStatuses: z.array(TargetStatusSchema).min(1),
  cooldownDays: z.number().int().positive(),
  status: TemplateStatusSchema.default("ACTIVE"),
});
export type CreateTemplateBodyDto = z.infer<typeof CreateTemplateBodySchema>;

/** `PUT /api/v1/recycling/templates/:id` body — every field optional, only supplied fields are patched. */
export const UpdateTemplateBodySchema = z.object({
  name: z.string().min(1).optional(),
  content: z.string().min(1).max(1000).optional(),
  targetStatuses: z.array(TargetStatusSchema).min(1).optional(),
  cooldownDays: z.number().int().positive().optional(),
  status: TemplateStatusSchema.optional(),
});
export type UpdateTemplateBodyDto = z.infer<typeof UpdateTemplateBodySchema>;

export interface TemplateResponseDto {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly targetStatuses: readonly string[];
  readonly cooldownDays: number;
  readonly status: string;
  readonly replyRate: number;
  readonly hotRate: number;
  readonly sentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toTemplateResponseDto(row: BroadcastTemplateRow): TemplateResponseDto {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    targetStatuses: row.target_statuses,
    cooldownDays: row.cooldown_days,
    status: row.status,
    replyRate: row.reply_rate,
    hotRate: row.hot_rate,
    sentCount: row.sent_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
