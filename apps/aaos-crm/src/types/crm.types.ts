/**
 * Client-safe DTO shapes returned by this app's own `src/app/api/*` proxy routes — deliberately
 * NOT imported from `apps/aaos-api`'s internal `dto/*.ts` files (a different app) or any `@aos/*`
 * package. Kept as plain, hand-written interfaces so nothing here can ever accidentally pull a
 * Node-only runtime value into a `"use client"` bundle (coordinator note #1).
 */

/** `Lead.qualification` — real boolean flags, NOT extracted values. Coordinator note #2: there is no budget amount / unit model / payment method anywhere on a real `Lead`. */
export interface LeadQualificationDto {
  readonly budget: boolean;
  readonly unit: boolean;
  readonly area: boolean;
  readonly payment: boolean;
  readonly timeline: boolean;
  readonly name: boolean;
}

export interface LeadDto {
  readonly id: string;
  readonly leadPhone: string;
  readonly leadName?: string;
  readonly branchId: string;
  readonly status: string;
  readonly temperature: string;
  readonly score: number;
  readonly qualification: LeadQualificationDto;
  readonly assignedSalesId?: string;
  readonly assignedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MessageDto {
  readonly id: string;
  readonly direction: string;
  readonly messageType: string;
  readonly body?: string;
  readonly sentAt?: string;
  readonly createdAt: string;
  /**
   * AAOS-CHAT-ROOM-JESSY — who authored an OUTGOING message (`"JESSY"` | `"SALES_HUMAN"` |
   * `"MANAGER_INTERVENTION"`), `undefined` for every INCOMING message (always the lead).
   */
  readonly senderType?: string;
  readonly senderName?: string;
}

/** `GET /api/leads/:leadId/scoring-history` — mirrors `aaos-api`'s `ScoringEventResponseDto`. */
export interface ScoringEventDto {
  readonly id: string;
  readonly leadId: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly delta: number;
  readonly reason: string;
  readonly triggeredBy?: string;
  readonly createdAt: string;
}

export interface ConversationSummaryDto {
  readonly messageCount: number;
  readonly incomingCount: number;
  readonly outgoingCount: number;
  readonly currentStage: string;
  readonly lastIntent?: string;
  readonly status: string;
  readonly startedAt: string;
  readonly lastMessageAt: string;
}

/** `GET /api/leads/:leadId` — coordinator note #2's honest lead-detail shape: real qualification flags + the REAL conversation history, no fabricated "Jessy summary" prose. */
export interface LeadDetailDto extends LeadDto {
  readonly conversation?: ConversationSummaryDto;
  readonly messages: readonly MessageDto[];
}

export type ClosingType = "TEST_DRIVE" | "SPK" | "CANCELLED";

export interface ClosingDto {
  readonly id: string;
  readonly leadId: string;
  readonly salesHumanId: string;
  readonly branchId: string;
  readonly closingType: string;
  readonly unitModel?: string;
  readonly unitPrice?: number;
  readonly commissionIdr?: number;
  readonly commissionPct?: number;
  readonly notes?: string;
  readonly testDriveAt?: string;
  readonly spkAt?: string;
  readonly createdAt: string;
}

export interface SalesStatsDto {
  readonly leadsToday: number;
  readonly testDriveThisMonth: number;
  readonly spkThisMonth: number;
  readonly commissionThisMonthIdr: number;
  readonly recentClosings: readonly ClosingDto[];
}

export interface ApiErrorBody {
  readonly error: { readonly code?: string; readonly message: string };
}
