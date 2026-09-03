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

/**
 * `gaps` can now come from either a SIMULATION (`samanthaCoverageScore`/`kaiScore`/`claraScore`/
 * `grade`/`verdict`) or a real LIVE agent run (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 —
 * `source: "LIVE_RUN"`, `scores`/`trend`) — see `apps/aaos-api`'s `dto/improvement-plan.dto.ts`'s
 * own `SimulationGapSchema`/`LiveRunGapSchema` discriminated union for the real shapes this mirrors.
 * All fields stay optional here (this DTO is deliberately NOT a discriminated union) since the
 * dashboard only ever reads by field presence (see `LearningMonitorClient.tsx`'s own rendering).
 */
export interface LearningGapDto {
  readonly source?: "SIMULATION" | "LIVE_RUN";
  readonly samanthaCoverageScore?: number;
  readonly kaiScore?: number;
  readonly claraScore?: number;
  readonly overallScore?: number;
  readonly grade?: string;
  readonly verdict?: string;
  /** LIVE_RUN only — the judged agent (redundant with the proposal's own `agent` field, kept here too since it's real, already-sent data from `LiveRunGapSchema`). */
  readonly agent?: string;
  /** LIVE_RUN only — real per-dimension `judge_results.scores`. */
  readonly scores?: Record<string, number>;
  /** LIVE_RUN only — real trend vs. this tenant+agent's recent judge history. */
  readonly trend?: "IMPROVING" | "STABLE" | "DECLINING";
  readonly feedbackItems?: readonly { readonly dimension: string; readonly message: string }[];
}

export interface LearningProposalDto {
  readonly id: string;
  readonly tenantId: string;
  readonly simulationId: string | null;
  /** AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — the real LIVE-run trigger source alternative to `simulationId`. Exactly one of the two is ever non-null. */
  readonly agentRunId: string | null;
  readonly agent: string;
  readonly analysis: string | null;
  readonly gaps: LearningGapDto;
  readonly improvements: readonly LearningImprovementDto[];
  readonly status:
    "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPLIED" | "AUTO_APPLY_BLOCKED_BY_SANDBOX" | string;
  readonly decidedBy: string | null;
  readonly decisionNotes: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
  /** AAOS Self-Improving, Phase SI-6 — the real, honest weekly accuracy-check verdict. `null` until the first real weekly check reaches this proposal. */
  readonly accuracyVerdict: "IMPROVED" | "REGRESSED" | "INCONCLUSIVE" | null;
  readonly accuracyReason: string | null;
  readonly accuracyScoreBefore: number | null;
  readonly accuracyScoreAfter: number | null;
  readonly accuracySampleBefore: number | null;
  readonly accuracySampleAfter: number | null;
  readonly accuracyCheckedAt: string | null;
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

/** AAOS Self-Improving, Phase SI-6 — real `agent_configs` row (Config editor). */
export interface AgentConfigDto {
  readonly id: string;
  readonly tenantId: string;
  readonly agent: string;
  readonly configKey: string;
  readonly value: string;
  readonly dataType: string;
  readonly description: string | null;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

export interface SetAgentConfigInput {
  readonly agent: string;
  readonly configKey: string;
  readonly value: number;
}

/** AAOS Self-Improving, Phase SI-6 — one real `judge_results` point for the Score Trend chart. */
export interface JudgeHistoryPointDto {
  readonly createdAt: string;
  readonly overall: number | null;
}

/** AAOS Self-Improving, Phase SI-6 — the real "Improve sekarang" manual-trigger result. */
export interface TriggerCheckResultDto {
  readonly triggered: boolean;
  readonly reason?: string;
}
