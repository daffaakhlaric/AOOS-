import type { Lead } from "@aos/lead-store";

/** One row of TAB 1's Recycling Pool table. */
export interface RecyclingPoolLeadResponseDto {
  readonly id: string;
  readonly leadName?: string;
  readonly leadPhone: string;
  readonly branchId: string;
  readonly status: string;
  readonly score: number;
  readonly temperature: string;
  readonly lastMessageAt?: string;
  readonly broadcastCount: number;
  readonly lastBroadcastAt?: string;
  readonly lastBroadcastTemplateId?: string;
  readonly readyToSend: boolean;
}

export function toRecyclingPoolLeadResponseDto(
  lead: Lead,
  readyToSend: boolean,
): RecyclingPoolLeadResponseDto {
  return {
    id: lead.id.toString(),
    leadName: lead.leadName,
    leadPhone: lead.leadPhone.toString(),
    branchId: lead.branchId,
    status: lead.status,
    score: lead.score,
    temperature: lead.temperature,
    lastMessageAt: lead.lastMessageAt?.toISOString(),
    broadcastCount: lead.broadcastCount,
    lastBroadcastAt: lead.lastBroadcastAt?.toISOString(),
    lastBroadcastTemplateId: lead.lastBroadcastTemplateId,
    readyToSend,
  };
}
