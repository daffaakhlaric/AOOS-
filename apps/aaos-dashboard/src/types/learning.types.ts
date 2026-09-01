/**
 * Client-safe DTO shapes for AAOS Self-Learning AI, Phase C (Learning Monitor) — mirrors
 * `apps/aaos-api`'s `LearningProposalResponseDto`/`PromptOverrideResponseDto` field-for-field.
 * Hand-written, not imported from `apps/aaos-api`, same "never pull a Node-only runtime value
 * into a `\"use client\"` bundle" discipline `dashboard.types.ts`'s own header doc establishes.
 */

export interface LearningImprovementDto {
  readonly agent: string;
  readonly type: string;
  readonly target: string;
  readonly before: string;
  readonly after: string;
  readonly reason: string;
  readonly severity: string;
}

export interface LearningGapDto {
  readonly samanthaCoverageScore?: number;
  readonly kaiScore?: number;
  readonly claraScore?: number;
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  readonly feedbackItems?: readonly { readonly dimension: string; readonly message: string }[];
}

export interface LearningProposalDto {
  readonly id: string;
  readonly tenantId: string;
  readonly simulationId: string | null;
  readonly agent: string;
  readonly analysis: string | null;
  readonly gaps: LearningGapDto;
  readonly improvements: readonly LearningImprovementDto[];
  readonly status: "PENDING" | "APPROVED" | "REJECTED" | string;
  readonly decidedBy: string | null;
  readonly decisionNotes: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
}

export interface PromptOverrideDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly promptKey: string;
  readonly content: string;
  readonly version: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly deactivatedAt: string | null;
}

export interface DecideProposalInput {
  readonly decidedBy?: string;
  readonly decisionNotes?: string;
}

export interface RollbackResultDto {
  readonly rolledBackToVersion: number | null;
}
