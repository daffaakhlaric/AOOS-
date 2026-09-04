/**
 * Client-safe DTO shapes for AAOS-OPERATING-MODE-APPROVAL-GATE — mirrors `apps/aaos-api`'s
 * `PendingActionResponseDto` field-for-field. Hand-written, not imported from `apps/aaos-api`, same
 * "never pull a Node-only runtime value into a `\"use client\"` bundle" discipline
 * `learning.types.ts`'s own header doc establishes.
 */

export interface PendingActionDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly actionType: string;
  readonly payload: Record<string, unknown>;
  readonly status: "PENDING" | "APPROVED" | "REJECTED" | string;
  readonly decidedBy: string | null;
  readonly decisionNotes: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
}

export interface DecidePendingActionInput {
  readonly decidedBy?: string;
  readonly decisionNotes?: string;
}
