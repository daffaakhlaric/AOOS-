import type { Lead } from "@aos/lead-store";

/** JSON-serializable projection of a `Lead` domain entity — every value object flattened to its primitive form. */
export interface LeadResponseDto {
  readonly id: string;
  readonly tenantId: string;
  readonly leadSource: string;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly adAccountId?: string;
  readonly leadPhone: string;
  readonly leadName?: string;
  readonly branchId: string;
  readonly wabaPhoneNumberId: string;
  readonly status: string;
  readonly score: number;
  readonly temperature: string;
  readonly assignedSalesId?: string;
  readonly assignedAt?: string;
  readonly firstMessageAt?: string;
  readonly lastMessageAt?: string;
  readonly becameHotAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toLeadResponseDto(lead: Lead): LeadResponseDto {
  return {
    id: lead.id.toString(),
    tenantId: lead.tenantId,
    leadSource: lead.leadSource,
    campaignId: lead.campaignId,
    adId: lead.adId,
    adAccountId: lead.adAccountId,
    leadPhone: lead.leadPhone.toString(),
    leadName: lead.leadName,
    branchId: lead.branchId,
    wabaPhoneNumberId: lead.wabaPhoneNumberId.toString(),
    status: lead.status,
    score: lead.score,
    temperature: lead.temperature,
    assignedSalesId: lead.assignedSalesId?.toString(),
    assignedAt: lead.assignedAt?.toISOString(),
    firstMessageAt: lead.firstMessageAt?.toISOString(),
    lastMessageAt: lead.lastMessageAt?.toISOString(),
    becameHotAt: lead.becameHotAt?.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}
