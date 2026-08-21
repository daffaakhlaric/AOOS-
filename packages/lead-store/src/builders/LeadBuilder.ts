import { BranchId, type AssignmentMode, type SalesHumanId } from "@aos/branch-manager";
import { err, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import { PhoneNumber, PhoneNumberId } from "@aos/whatsapp-connector";

import { Lead, type LeadQualificationFlags } from "../domain/entities/Lead.js";
import { LeadId } from "../domain/value-objects/LeadId.js";
import { LeadSource } from "../domain/value-objects/LeadSource.js";
import { LeadStatus, type TemperatureStatus } from "../domain/value-objects/LeadStatus.js";

/** Fluent builder (Builder Pattern) for `Lead`, with sensible defaults so callers only override what matters for their scenario — mirrors `@aos/branch-manager`'s `SalesHumanBuilder`. */
export class LeadBuilder {
  private id: LeadId = LeadId.generate();
  private tenantId = "dss-motor";
  private leadSource: LeadSource = LeadSource.CTWA;
  private campaignId: string | undefined;
  private adId: string | undefined;
  private adAccountId: string | undefined;
  private leadPhone = "+6281200000099";
  private leadName: string | undefined;
  private branchId: BranchId = BranchId.BINTARO;
  private wabaPhoneNumberId = "waba-bintaro-001";
  private status: LeadStatus = LeadStatus.NEW;
  private score = 0;
  private temperature: TemperatureStatus = LeadStatus.COLD;
  private qualification: LeadQualificationFlags = {
    budget: false,
    unit: false,
    area: false,
    payment: false,
    timeline: false,
    name: false,
  };
  private assignedSalesId: SalesHumanId | undefined;
  private assignedAt: Date | undefined;
  private assignmentMode: AssignmentMode | undefined;
  private firstMessageAt: Date | undefined;
  private lastMessageAt: Date | undefined;
  private becameHotAt: Date | undefined;
  private broadcastCount = 0;
  private lastBroadcastAt: Date | undefined;
  private lastBroadcastTemplateId: string | undefined;
  private recyclingArchived = false;
  private createdAt = new Date("2026-01-01T00:00:00.000Z");
  private updatedAt = new Date("2026-01-01T00:00:00.000Z");

  withId(id: LeadId): this {
    this.id = id;
    return this;
  }

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withLeadSource(leadSource: LeadSource): this {
    this.leadSource = leadSource;
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

  withAdAccountId(adAccountId: string | undefined): this {
    this.adAccountId = adAccountId;
    return this;
  }

  withLeadPhone(leadPhone: string): this {
    this.leadPhone = leadPhone;
    return this;
  }

  withLeadName(leadName: string | undefined): this {
    this.leadName = leadName;
    return this;
  }

  withBranchId(branchId: BranchId): this {
    this.branchId = branchId;
    return this;
  }

  withWabaPhoneNumberId(wabaPhoneNumberId: string): this {
    this.wabaPhoneNumberId = wabaPhoneNumberId;
    return this;
  }

  withStatus(status: LeadStatus): this {
    this.status = status;
    return this;
  }

  withScore(score: number): this {
    this.score = score;
    return this;
  }

  withTemperature(temperature: TemperatureStatus): this {
    this.temperature = temperature;
    return this;
  }

  withQualification(qualification: LeadQualificationFlags): this {
    this.qualification = qualification;
    return this;
  }

  withAssignedSalesId(assignedSalesId: SalesHumanId | undefined): this {
    this.assignedSalesId = assignedSalesId;
    return this;
  }

  withAssignedAt(assignedAt: Date | undefined): this {
    this.assignedAt = assignedAt;
    return this;
  }

  withAssignmentMode(assignmentMode: AssignmentMode | undefined): this {
    this.assignmentMode = assignmentMode;
    return this;
  }

  withFirstMessageAt(firstMessageAt: Date | undefined): this {
    this.firstMessageAt = firstMessageAt;
    return this;
  }

  withLastMessageAt(lastMessageAt: Date | undefined): this {
    this.lastMessageAt = lastMessageAt;
    return this;
  }

  withBecameHotAt(becameHotAt: Date | undefined): this {
    this.becameHotAt = becameHotAt;
    return this;
  }

  withBroadcastCount(broadcastCount: number): this {
    this.broadcastCount = broadcastCount;
    return this;
  }

  withLastBroadcastAt(lastBroadcastAt: Date | undefined): this {
    this.lastBroadcastAt = lastBroadcastAt;
    return this;
  }

  withLastBroadcastTemplateId(lastBroadcastTemplateId: string | undefined): this {
    this.lastBroadcastTemplateId = lastBroadcastTemplateId;
    return this;
  }

  withRecyclingArchived(recyclingArchived: boolean): this {
    this.recyclingArchived = recyclingArchived;
    return this;
  }

  withCreatedAt(createdAt: Date): this {
    this.createdAt = createdAt;
    return this;
  }

  withUpdatedAt(updatedAt: Date): this {
    this.updatedAt = updatedAt;
    return this;
  }

  build(): Result<Lead, ValidationError> {
    const phoneResult = PhoneNumber.create(this.leadPhone);
    if (!phoneResult.ok) {
      return err(phoneResult.error);
    }
    const wabaIdResult = PhoneNumberId.create(this.wabaPhoneNumberId);
    if (!wabaIdResult.ok) {
      return err(wabaIdResult.error);
    }

    return Lead.create({
      id: this.id,
      tenantId: this.tenantId,
      leadSource: this.leadSource,
      campaignId: this.campaignId,
      adId: this.adId,
      adAccountId: this.adAccountId,
      leadPhone: phoneResult.value,
      leadName: this.leadName,
      branchId: this.branchId,
      wabaPhoneNumberId: wabaIdResult.value,
      status: this.status,
      score: this.score,
      temperature: this.temperature,
      qualification: this.qualification,
      assignedSalesId: this.assignedSalesId,
      assignedAt: this.assignedAt,
      assignmentMode: this.assignmentMode,
      firstMessageAt: this.firstMessageAt,
      lastMessageAt: this.lastMessageAt,
      becameHotAt: this.becameHotAt,
      broadcastCount: this.broadcastCount,
      lastBroadcastAt: this.lastBroadcastAt,
      lastBroadcastTemplateId: this.lastBroadcastTemplateId,
      recyclingArchived: this.recyclingArchived,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }
}
