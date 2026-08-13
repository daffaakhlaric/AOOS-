/**
 * Client-safe DTO shapes returned by this app's own `src/app/api/*` proxy routes — deliberately
 * NOT imported from `apps/aaos-api`'s internal `dto/*.ts` files (a different app) or any `@aos/*`
 * package. Kept as plain, hand-written interfaces so nothing here can ever accidentally pull a
 * Node-only runtime value into a `"use client"` bundle (AAOS-W4A coordinator note #2).
 */

export interface AdMetricsDto {
  readonly spend: number;
  readonly conversations: number;
  readonly d2: number;
  readonly d3: number;
  readonly d5: number;
  readonly leadForm: number;
  readonly totalLead: number;
  readonly rphD3: number | null;
}

export interface CampaignAdDto {
  readonly id: string;
  readonly name: string;
  readonly campaignName: string;
  readonly status: string;
  readonly funnel: string;
  readonly branch: string;
  readonly verdict: string;
  readonly metrics: AdMetricsDto;
}

export interface AdAccountSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly syncedAt: string;
  readonly ads: readonly CampaignAdDto[];
  readonly totals: AdMetricsDto;
}

export interface ObjectiveDto {
  readonly id: string;
  readonly tenantId: string;
  readonly period: { readonly month: number; readonly year: number };
  readonly targetHotLeads: number;
  readonly budgetAllocation: number;
  readonly focusUnits: readonly string[];
  readonly areaPriorities: readonly string[];
  readonly status: string;
  readonly createdAt: string;
}

export interface CopyVariantDto {
  readonly id: string;
  readonly variantLabel: "A" | "B" | "C";
  readonly primaryText: string;
  readonly headline: string;
  readonly callToAction: string;
}

export interface CreativePackageDto {
  readonly id: string;
  readonly briefId: string;
  readonly branch: string;
  readonly unit: string;
  readonly title: string;
  readonly videoUrl?: string;
  readonly imageUrls: readonly string[];
  readonly copyVariants: readonly CopyVariantDto[];
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly selectedCopyVariantId?: string;
  readonly createdAt: string;
  readonly reviewedAt?: string;
}

export interface SalesHumanDto {
  readonly id: string;
  readonly name: string;
  readonly waNumber: string;
  readonly status: "ON" | "BUSY" | "OFF";
  readonly maxLeadsPerDay: number;
  readonly todayLeadCount: number;
  readonly isAvailable: boolean;
}

export interface BranchDto {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly wabaPhoneNumber: string;
  readonly assignmentMode: "SMART_ASSIGN" | "ROUND_ROBIN" | "MANUAL";
  readonly maxLeadsPerSalesPerDay: number;
  readonly active: boolean;
  readonly team: readonly SalesHumanDto[];
  readonly availableCount: number;
  readonly queueSize: number;
  readonly todayAssignedCount: number;
}

export interface LeadDto {
  readonly id: string;
  readonly leadPhone: string;
  readonly leadName?: string;
  readonly branchId: string;
  readonly status: string;
  readonly temperature: string;
  readonly score: number;
  readonly createdAt: string;
}

export interface ApiErrorBody {
  readonly error: { readonly code?: string; readonly message: string };
}
