import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { err, ErrorCode, ok, type Result } from "@aos/common";
import { PhoneNumber, PhoneNumberId } from "@aos/whatsapp-connector";

import { Lead } from "../../domain/entities/Lead.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";
import { parseLeadSource } from "../../domain/value-objects/LeadSource.js";
import {
  isTemperatureStatus,
  parseLeadStatus,
  type TemperatureStatus,
} from "../../domain/value-objects/LeadStatus.js";

/** Exact shape of the `leads` table (spec `001_initial_schema.sql`), snake_case as Postgres returns it. */
export interface LeadRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly lead_source: string;
  readonly campaign_id: string | null;
  readonly ad_id: string | null;
  readonly ad_account_id: string | null;
  readonly lead_phone: string;
  readonly lead_name: string | null;
  readonly branch_id: string;
  readonly waba_phone_number_id: string;
  readonly status: string;
  readonly score: number;
  readonly temperature: string;
  readonly qual_budget: boolean;
  readonly qual_unit: boolean;
  readonly qual_area: boolean;
  readonly qual_payment: boolean;
  readonly qual_timeline: boolean;
  readonly qual_name: boolean;
  readonly assigned_sales_id: string | null;
  readonly assigned_at: string | null;
  readonly assignment_mode: string | null;
  readonly first_message_at: string | null;
  readonly last_message_at: string | null;
  readonly became_hot_at: string | null;
  /** Lead Recycling & Broadcast (AAOS-LEAD-RECYCLING-BROADCAST, `005_recycling_fields.sql`). */
  readonly broadcast_count: number;
  readonly last_broadcast_at: string | null;
  readonly last_broadcast_template_id: string | null;
  readonly recycling_archived: boolean;
  /** A/B Testing & Lookalike (AAOS-ABTESTING-LOOKALIKE Part 2, `006_lookalike_sync_fields.sql`). */
  readonly synced_to_meta_audience: boolean;
  readonly synced_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Maps between `leads` DB rows and the `Lead` domain entity — field-by-field, both directions. */
export class LeadMapper {
  static toDomain(row: LeadRow): Result<Lead, LeadStoreError> {
    const phoneResult = PhoneNumber.create(row.lead_phone);
    if (!phoneResult.ok) {
      return err(
        new LeadStoreError(phoneResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const wabaIdResult = PhoneNumberId.create(row.waba_phone_number_id);
    if (!wabaIdResult.ok) {
      return err(
        new LeadStoreError(wabaIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const sourceResult = parseLeadSource(row.lead_source);
    if (!sourceResult.ok) {
      return err(
        new LeadStoreError(sourceResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const statusResult = parseLeadStatus(row.status);
    if (!statusResult.ok) {
      return err(
        new LeadStoreError(statusResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    const temperatureResult = parseLeadStatus(row.temperature);
    if (!temperatureResult.ok || !isTemperatureStatus(temperatureResult.value)) {
      return err(
        new LeadStoreError(
          `Lead.temperature must be COLD, WARM, or HOT, received: "${row.temperature}"`,
          {
            code: ErrorCode.VALIDATION_ERROR,
          },
        ),
      );
    }
    if (!Object.values(BranchId).includes(row.branch_id as BranchId)) {
      return err(
        new LeadStoreError(`Lead.branch_id is not a valid BranchId: "${row.branch_id}"`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    let assignedSalesId: SalesHumanId | undefined;
    if (row.assigned_sales_id !== null) {
      const salesIdResult = SalesHumanId.create(row.assigned_sales_id);
      if (!salesIdResult.ok) {
        return err(
          new LeadStoreError(salesIdResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
        );
      }
      assignedSalesId = salesIdResult.value;
    }

    let assignmentMode: AssignmentMode | undefined;
    if (row.assignment_mode !== null) {
      if (!Object.values(AssignmentMode).includes(row.assignment_mode as AssignmentMode)) {
        return err(
          new LeadStoreError(
            `Lead.assignment_mode is not a valid AssignmentMode: "${row.assignment_mode}"`,
            {
              code: ErrorCode.VALIDATION_ERROR,
            },
          ),
        );
      }
      assignmentMode = row.assignment_mode as AssignmentMode;
    }

    const idResult = LeadId.create(row.id);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }

    const leadResult = Lead.create({
      id: idResult.value,
      tenantId: row.tenant_id,
      leadSource: sourceResult.value,
      campaignId: row.campaign_id ?? undefined,
      adId: row.ad_id ?? undefined,
      adAccountId: row.ad_account_id ?? undefined,
      leadPhone: phoneResult.value,
      leadName: row.lead_name ?? undefined,
      branchId: row.branch_id as BranchId,
      wabaPhoneNumberId: wabaIdResult.value,
      status: statusResult.value,
      score: row.score,
      temperature: temperatureResult.value as TemperatureStatus,
      qualification: {
        budget: row.qual_budget,
        unit: row.qual_unit,
        area: row.qual_area,
        payment: row.qual_payment,
        timeline: row.qual_timeline,
        name: row.qual_name,
      },
      assignedSalesId,
      assignedAt: row.assigned_at !== null ? new Date(row.assigned_at) : undefined,
      assignmentMode,
      firstMessageAt: row.first_message_at !== null ? new Date(row.first_message_at) : undefined,
      lastMessageAt: row.last_message_at !== null ? new Date(row.last_message_at) : undefined,
      becameHotAt: row.became_hot_at !== null ? new Date(row.became_hot_at) : undefined,
      // `?? 0`/`row.x != null` (loose, catches BOTH `null` and `undefined`) rather than the
      // `!== null`-only pattern the older fields above use: those 4 new AAOS-LEAD-RECYCLING-
      // BROADCAST columns are additive on top of an already-large body of hand-rolled `LeadRow`
      // test fixtures across this monorepo written before this migration existed, which construct
      // a row object without these keys at all (JS `undefined`, not SQL `NULL`) — a real Postgres
      // row always has an explicit `NULL`, but backward-compatibility with those pre-existing
      // fixtures requires tolerating `undefined` too, defaulting exactly like the migration's own
      // `DEFAULT 0`/`DEFAULT false`.
      broadcastCount: row.broadcast_count ?? 0,
      lastBroadcastAt: row.last_broadcast_at != null ? new Date(row.last_broadcast_at) : undefined,
      lastBroadcastTemplateId: row.last_broadcast_template_id ?? undefined,
      recyclingArchived: row.recycling_archived ?? false,
      // Same tolerant `?? false`/`!= null` pattern as the recycling columns above — see that
      // comment for why pre-existing hand-rolled `LeadRow` test fixtures may omit these keys.
      syncedToMetaAudience: row.synced_to_meta_audience ?? false,
      syncedAt: row.synced_at != null ? new Date(row.synced_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
    if (!leadResult.ok) {
      return err(
        new LeadStoreError(leadResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }
    return ok(leadResult.value);
  }

  static toRow(lead: Lead): LeadRow {
    return {
      id: lead.id.toString(),
      tenant_id: lead.tenantId,
      lead_source: lead.leadSource,
      campaign_id: lead.campaignId ?? null,
      ad_id: lead.adId ?? null,
      ad_account_id: lead.adAccountId ?? null,
      lead_phone: lead.leadPhone.toString(),
      lead_name: lead.leadName ?? null,
      branch_id: lead.branchId,
      waba_phone_number_id: lead.wabaPhoneNumberId.toString(),
      status: lead.status,
      score: lead.score,
      temperature: lead.temperature,
      qual_budget: lead.qualification.budget,
      qual_unit: lead.qualification.unit,
      qual_area: lead.qualification.area,
      qual_payment: lead.qualification.payment,
      qual_timeline: lead.qualification.timeline,
      qual_name: lead.qualification.name,
      assigned_sales_id: lead.assignedSalesId?.toString() ?? null,
      assigned_at: lead.assignedAt?.toISOString() ?? null,
      assignment_mode: lead.assignmentMode ?? null,
      first_message_at: lead.firstMessageAt?.toISOString() ?? null,
      last_message_at: lead.lastMessageAt?.toISOString() ?? null,
      became_hot_at: lead.becameHotAt?.toISOString() ?? null,
      broadcast_count: lead.broadcastCount,
      last_broadcast_at: lead.lastBroadcastAt?.toISOString() ?? null,
      last_broadcast_template_id: lead.lastBroadcastTemplateId ?? null,
      recycling_archived: lead.recyclingArchived,
      synced_to_meta_audience: lead.syncedToMetaAudience,
      synced_at: lead.syncedAt?.toISOString() ?? null,
      created_at: lead.createdAt.toISOString(),
      updated_at: lead.updatedAt.toISOString(),
    };
  }
}
