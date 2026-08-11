import { BranchId, SalesHumanId } from "@aos/branch-manager";
import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { Closing } from "../domain/entities/Closing.js";
import { ClosingId } from "../domain/value-objects/ClosingId.js";
import { ClosingType } from "../domain/value-objects/ClosingType.js";
import { LeadId } from "../domain/value-objects/LeadId.js";

/** Fluent builder (Builder Pattern) for `Closing`, with sensible defaults so callers only override what matters for their scenario. */
export class ClosingBuilder {
  private id: ClosingId = ClosingId.generate();
  private leadId: LeadId = LeadId.generate();
  private salesHumanId: SalesHumanId = SalesHumanId.generate();
  private branchId: BranchId = BranchId.BINTARO;
  private closingType: ClosingType = ClosingType.SPK;
  private unitId: string | undefined;
  private unitModel: string | undefined;
  private unitPrice: number | undefined;
  private campaignId: string | undefined;
  private adId: string | undefined;
  private commissionIdr: number | undefined;
  private commissionPct: number | undefined;
  private notes: string | undefined;
  private testDriveAt: Date | undefined;
  private spkAt: Date | undefined;
  private createdAt = new Date("2026-01-01T00:00:00.000Z");

  withId(id: ClosingId): this {
    this.id = id;
    return this;
  }

  withLeadId(leadId: LeadId): this {
    this.leadId = leadId;
    return this;
  }

  withSalesHumanId(salesHumanId: SalesHumanId): this {
    this.salesHumanId = salesHumanId;
    return this;
  }

  withBranchId(branchId: BranchId): this {
    this.branchId = branchId;
    return this;
  }

  withClosingType(closingType: ClosingType): this {
    this.closingType = closingType;
    return this;
  }

  withUnitId(unitId: string | undefined): this {
    this.unitId = unitId;
    return this;
  }

  withUnitModel(unitModel: string | undefined): this {
    this.unitModel = unitModel;
    return this;
  }

  withUnitPrice(unitPrice: number | undefined): this {
    this.unitPrice = unitPrice;
    return this;
  }

  withCampaignId(campaignId: string | undefined): this {
    this.campaignId = campaignId;
    return this;
  }

  withAdId(adId: string | undefined): this {
    this.adId = adId;
    return this;
  }

  withCommissionIdr(commissionIdr: number | undefined): this {
    this.commissionIdr = commissionIdr;
    return this;
  }

  withCommissionPct(commissionPct: number | undefined): this {
    this.commissionPct = commissionPct;
    return this;
  }

  withNotes(notes: string | undefined): this {
    this.notes = notes;
    return this;
  }

  withTestDriveAt(testDriveAt: Date | undefined): this {
    this.testDriveAt = testDriveAt;
    return this;
  }

  withSpkAt(spkAt: Date | undefined): this {
    this.spkAt = spkAt;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.createdAt = createdAt;
    return this;
  }

  build(): Result<Closing, ValidationError> {
    return Closing.create({
      id: this.id,
      leadId: this.leadId,
      salesHumanId: this.salesHumanId,
      branchId: this.branchId,
      closingType: this.closingType,
      unitId: this.unitId,
      unitModel: this.unitModel,
      unitPrice: this.unitPrice,
      campaignId: this.campaignId,
      adId: this.adId,
      commissionIdr: this.commissionIdr,
      commissionPct: this.commissionPct,
      notes: this.notes,
      testDriveAt: this.testDriveAt,
      spkAt: this.spkAt,
      createdAt: this.createdAt,
    });
  }
}
