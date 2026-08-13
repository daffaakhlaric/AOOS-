import type { Closing } from "@aos/lead-store";

/** JSON-serializable projection of a `Closing` domain entity. */
export interface ClosingResponseDto {
  readonly id: string;
  readonly leadId: string;
  readonly salesHumanId: string;
  readonly branchId: string;
  readonly closingType: string;
  readonly unitId?: string;
  readonly unitModel?: string;
  readonly unitPrice?: number;
  readonly campaignId?: string;
  readonly adId?: string;
  readonly commissionIdr?: number;
  readonly commissionPct?: number;
  readonly notes?: string;
  readonly testDriveAt?: string;
  readonly spkAt?: string;
  readonly createdAt: string;
}

export function toClosingResponseDto(closing: Closing): ClosingResponseDto {
  return {
    id: closing.id.toString(),
    leadId: closing.leadId.toString(),
    salesHumanId: closing.salesHumanId.toString(),
    branchId: closing.branchId,
    closingType: closing.closingType,
    unitId: closing.unitId,
    unitModel: closing.unitModel,
    unitPrice: closing.unitPrice,
    campaignId: closing.campaignId,
    adId: closing.adId,
    commissionIdr: closing.commissionIdr,
    commissionPct: closing.commissionPct,
    notes: closing.notes,
    testDriveAt: closing.testDriveAt?.toISOString(),
    spkAt: closing.spkAt?.toISOString(),
    createdAt: closing.createdAt.toISOString(),
  };
}
