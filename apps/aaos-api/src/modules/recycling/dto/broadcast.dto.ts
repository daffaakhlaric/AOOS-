import { z } from "zod";

/** `POST /api/v1/recycling/broadcast/:leadId` body — TAB 1's "Kirim ▶" modal's "Kirim Sekarang". */
export const BroadcastToLeadBodySchema = z.object({
  templateId: z.string().min(1),
});
export type BroadcastToLeadBodyDto = z.infer<typeof BroadcastToLeadBodySchema>;

export interface BroadcastResultDto {
  readonly leadId: string;
  readonly templateId: string;
  readonly broadcastLogId: string;
  readonly sentAt: string;
}

/** `POST /api/v1/recycling/broadcast-all` result — the "Broadcast ke Semua yang Siap" button's real, honest outcome. */
export interface BroadcastAllResultDto {
  readonly attempted: number;
  readonly sent: readonly BroadcastResultDto[];
  readonly failed: ReadonlyArray<{ readonly leadId: string; readonly reason: string }>;
}
