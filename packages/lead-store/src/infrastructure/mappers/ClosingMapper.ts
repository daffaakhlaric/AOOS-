import { BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";

import { Closing } from "../../domain/entities/Closing.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import { ClosingId } from "../../domain/value-objects/ClosingId.js";
import { parseClosingType } from "../../domain/value-objects/ClosingType.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";

/** Exact shape of the `closings` table (spec `001_initial_schema.sql`). */
export interface ClosingRow {
  readonly id: string;
  readonly lead_id: string;
  readonly sales_human_id: string;
  readonly branch_id: string;
  readonly closing_type: string;
  readonly unit_id: string | null;
  readonly unit_model: string | null;
  readonly unit_price: number | null;
  readonly campaign_id: string | null;
  readonly ad_id: string | null;
  readonly commission_idr: number | null;
  readonly commission_pct: number | null;
  readonly notes: string | null;
  readonly test_drive_at: string | null;
  readonly spk_at: string | null;
  readonly created_at: string;
}

/** Maps between `closings` DB rows and the `Closing` domain entity — field-by-field, both directions. */
export class ClosingMapper {
  static toDomain(row: ClosingRow): Result<Closing, LeadStoreError> {
    const idResult = ClosingId.create(row.id);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }
    const leadIdResult = LeadId.create(row.lead_id);
    if (!leadIdResult.ok) {
      return err(
        new LeadStoreError(leadIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const salesIdResult = SalesHumanId.create(row.sales_human_id);
    if (!salesIdResult.ok) {
      return err(
        new LeadStoreError(salesIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    if (!Object.values(BranchId).includes(row.branch_id as BranchId)) {
      return err(
        new LeadStoreError(`Closing.branch_id is not a valid BranchId: "${row.branch_id}"`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }
    const closingTypeResult = parseClosingType(row.closing_type);
    if (!closingTypeResult.ok) {
      return err(
        new LeadStoreError(closingTypeResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }

    const closingResult = Closing.create({
      id: idResult.value,
      leadId: leadIdResult.value,
      salesHumanId: salesIdResult.value,
      branchId: row.branch_id as BranchId,
      closingType: closingTypeResult.value,
      unitId: row.unit_id ?? undefined,
      unitModel: row.unit_model ?? undefined,
      unitPrice: row.unit_price ?? undefined,
      campaignId: row.campaign_id ?? undefined,
      adId: row.ad_id ?? undefined,
      commissionIdr: row.commission_idr ?? undefined,
      commissionPct: row.commission_pct ?? undefined,
      notes: row.notes ?? undefined,
      testDriveAt: row.test_drive_at !== null ? new Date(row.test_drive_at) : undefined,
      spkAt: row.spk_at !== null ? new Date(row.spk_at) : undefined,
      createdAt: new Date(row.created_at),
    });
    if (!closingResult.ok) {
      return err(
        new LeadStoreError(closingResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    return ok(closingResult.value);
  }

  static toRow(closing: Closing): ClosingRow {
    return {
      id: closing.id.toString(),
      lead_id: closing.leadId.toString(),
      sales_human_id: closing.salesHumanId.toString(),
      branch_id: closing.branchId,
      closing_type: closing.closingType,
      unit_id: closing.unitId ?? null,
      unit_model: closing.unitModel ?? null,
      unit_price: closing.unitPrice ?? null,
      campaign_id: closing.campaignId ?? null,
      ad_id: closing.adId ?? null,
      commission_idr: closing.commissionIdr ?? null,
      commission_pct: closing.commissionPct ?? null,
      notes: closing.notes ?? null,
      test_drive_at: closing.testDriveAt?.toISOString() ?? null,
      spk_at: closing.spkAt?.toISOString() ?? null,
      created_at: closing.createdAt.toISOString(),
    };
  }
}
