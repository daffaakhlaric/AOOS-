import { z } from "zod";

import type { BroadcastLogRow } from "../infrastructure/broadcast-log.repository.js";

/** `GET /api/v1/recycling/logs` — TAB 3's Riwayat Broadcast. */
export const GetLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(200),
});
export type GetLogsQueryDto = z.infer<typeof GetLogsQuerySchema>;

export interface BroadcastLogResponseDto {
  readonly id: string;
  readonly leadId: string;
  readonly templateId?: string;
  readonly messageSent: string;
  readonly status: string;
  readonly sentAt: string;
  readonly deliveredAt?: string;
  readonly readAt?: string;
  readonly replied: boolean;
  readonly repliedAt?: string;
  readonly convertedToHot: boolean;
  readonly convertedAt?: string;
}

export function toBroadcastLogResponseDto(row: BroadcastLogRow): BroadcastLogResponseDto {
  return {
    id: row.id,
    leadId: row.lead_id,
    templateId: row.template_id ?? undefined,
    messageSent: row.message_sent,
    status: row.status,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at ?? undefined,
    readAt: row.read_at ?? undefined,
    replied: row.replied,
    repliedAt: row.replied_at ?? undefined,
    convertedToHot: row.converted_to_hot,
    convertedAt: row.converted_at ?? undefined,
  };
}
