import type {
  RecommendedActionType,
  SamanthaDecision,
} from "../../campaign-health/domain/decision.js";
import type { AutomationMode } from "../../growth-objectives/dto/growth-objective.dto.js";

import { PACE_PROFILES, type GrowthPolicy, type GROWTH_ACTIONS } from "./growth-policy.js";

export interface GrowthExecutionEvidence {
  readonly policyVersion: number;
  readonly currentPolicyVersion: number;
  readonly action: (typeof GROWTH_ACTIONS)[number];
  readonly confidence: number;
  readonly trackingHealthy?: boolean;
  readonly learningProtected?: boolean;
  readonly dataSufficient?: boolean;
  readonly campaignActive?: boolean;
  readonly crmAgeHours?: number;
  readonly qualifiedRate?: number;
  readonly hoursSinceEdit?: number;
  readonly observationHours?: number;
  readonly leads?: number;
  readonly costPerOutcome?: number;
  readonly currentBudget?: number;
  readonly requestedBudget?: number;
  readonly accountDailySpend?: number;
  readonly monthSpend?: number;
  readonly activeCreatives?: number;
  readonly qaPassed?: boolean;
  readonly simulationPassed?: boolean;
  readonly claimsVerified?: boolean;
}

/** Explicit human campaign-status actions still obey the canonical policy and version. */
export function evaluateCampaignStatusPolicy(
  policy: GrowthPolicy,
  action: string,
  approvedVersion: number,
  currentVersion: number,
): string[] {
  const blocked: string[] = [];
  if (approvedVersion !== currentVersion) blocked.push("REAPPROVAL_REQUIRED");
  if (policy.safetyPolicy.killSwitch) blocked.push("KILL_SWITCH");
  if (action !== "PAUSE_CAMPAIGN" && action !== "RESUME_CAMPAIGN")
    blocked.push("STATUS_ACTION_UNSUPPORTED");
  else if (policy.safetyPolicy.permissions[action] === "DISABLED") blocked.push("ACTION_DISABLED");
  // Resume spends money again; tracking/learning safeguards must be bound before this is enabled.
  if (action === "RESUME_CAMPAIGN") blocked.push("RESUME_EVIDENCE_UNVERIFIED");
  return blocked;
}

/** Extends the existing policy engine; unknown evidence fails closed, even after approval. */
export function evaluateApprovedPausePolicy(
  policy: GrowthPolicy,
  evidence: {
    confidence?: number;
    daysCovered?: number;
    dataLevel?: string;
    spend?: number;
    leads?: number;
    diagnosis?: string;
  },
): string[] {
  const blocked: string[] = [];
  // This path stops spend after explicit human approval. It cannot authorize scaling,
  // resume, or claims about qualified leads from unavailable CRM/tracking evidence.
  if (policy.optimizationBasis !== "META_LEAD" || policy.conversionPolicy.primaryMetric !== "LEAD")
    blocked.push("PAUSE_OUTCOME_BASIS_UNVERIFIED");
  if (evidence.diagnosis !== "SPEND_WITHOUT_RESULT") blocked.push("PAUSE_DIAGNOSIS_UNVERIFIED");
  if (
    typeof evidence.confidence !== "number" ||
    !Number.isFinite(evidence.confidence) ||
    evidence.confidence > 1 ||
    evidence.confidence < policy.safetyPolicy.minimumConfidence
  )
    blocked.push("LOW_CONFIDENCE");
  if (!["MEDIUM", "HIGH"].includes(evidence.dataLevel ?? "")) blocked.push("INSUFFICIENT_DATA");
  if (
    typeof evidence.daysCovered !== "number" ||
    !Number.isFinite(evidence.daysCovered) ||
    evidence.daysCovered * 24 < policy.budgetPolicy.minimumObservationHours
  )
    blocked.push("OBSERVATION_WINDOW");
  if (
    typeof evidence.spend !== "number" ||
    !Number.isFinite(evidence.spend) ||
    evidence.spend <= 0 ||
    evidence.leads !== 0
  )
    blocked.push("PAUSE_METRICS_UNVERIFIED");
  return blocked;
}

export function evaluateGrowthPolicy(policy: GrowthPolicy, e: GrowthExecutionEvidence) {
  const blocked: string[] = [];
  // JSON normally excludes NaN, but internal metric calculations can still produce it.
  // Never let comparisons against NaN silently satisfy a spending guard.
  for (const key of [
    "crmAgeHours",
    "qualifiedRate",
    "hoursSinceEdit",
    "observationHours",
    "leads",
    "costPerOutcome",
    "accountDailySpend",
    "monthSpend",
    "activeCreatives",
  ] as const) {
    const value = e[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0))
      blocked.push(`INVALID_EVIDENCE_${key}`);
  }
  if (!["SCALE", "PAUSE_CREATIVE", "REQUEST_KAI_REFRESH", "PUBLISH_CREATIVE"].includes(e.action))
    blocked.push("ACTION_GUARDS_NOT_CONNECTED");
  const p = policy.budgetPolicy;
  if (e.policyVersion !== e.currentPolicyVersion) blocked.push("STALE_POLICY");
  if (policy.safetyPolicy.killSwitch) blocked.push("KILL_SWITCH");
  if (policy.safetyPolicy.permissions[e.action] === "DISABLED") blocked.push("ACTION_DISABLED");
  if (!Number.isFinite(e.confidence) || e.confidence < policy.safetyPolicy.minimumConfidence)
    blocked.push("LOW_CONFIDENCE");
  if (["SCALE", "UPDATE_AUDIENCE", "ACTIVATE_CAMPAIGN", "PUBLISH_CREATIVE"].includes(e.action)) {
    if (e.trackingHealthy !== true) blocked.push("TRACKING_UNVERIFIED");
    if (e.learningProtected !== false) blocked.push("LEARNING_UNVERIFIED_OR_PROTECTED");
    if (e.dataSufficient !== true) blocked.push("INSUFFICIENT_DATA");
    if (
      policy.optimizationBasis !== "META_LEAD" &&
      policy.conversionPolicy.primaryMetric !== "LEAD"
    ) {
      if (
        e.crmAgeHours === undefined ||
        e.crmAgeHours < 0 ||
        e.crmAgeHours > policy.conversionPolicy.maximumCrmAgeHours
      )
        blocked.push("CRM_STALE_OR_MISSING");
      if (
        e.qualifiedRate === undefined ||
        e.qualifiedRate < policy.conversionPolicy.minimumQualifiedRate
      )
        blocked.push("QUALITY_UNVERIFIED_OR_LOW");
    }
  }
  const pace = PACE_PROFILES[policy.pace];
  const allowedScalePercent = Math.min(p.maxScalePercentPerAction, pace.scalePercent);
  if (e.action === "SCALE") {
    if (!p.autoScaleEnabled) blocked.push("SCALING_DISABLED");
    if (e.campaignActive !== true) blocked.push("CAMPAIGN_NOT_ACTIVE");
    if (e.observationHours === undefined || e.observationHours < p.minimumObservationHours)
      blocked.push("OBSERVATION_WINDOW");
    if (
      e.hoursSinceEdit === undefined ||
      e.hoursSinceEdit < Math.max(p.scaleCooldownHours, pace.cooldownHours)
    )
      blocked.push("EDIT_COOLDOWN");
    if (e.leads === undefined || e.leads < p.minimumLeads) blocked.push("MINIMUM_SAMPLE");
    if (
      p.maximumCostPerOutcome !== null &&
      (e.costPerOutcome === undefined || e.costPerOutcome > p.maximumCostPerOutcome)
    )
      blocked.push("COST_THRESHOLD");
    if (
      e.currentBudget === undefined ||
      e.requestedBudget === undefined ||
      !Number.isFinite(e.currentBudget) ||
      !Number.isFinite(e.requestedBudget) ||
      e.currentBudget <= 0 ||
      e.requestedBudget <= e.currentBudget
    )
      blocked.push("INVALID_BUDGET_TARGET");
    else {
      if ((e.requestedBudget / e.currentBudget - 1) * 100 > allowedScalePercent + 1e-9)
        blocked.push("SCALE_STEP_CAP");
      if (
        p.dailyBudgetCeiling === null ||
        e.requestedBudget > p.dailyBudgetCeiling ||
        e.requestedBudget < p.dailyBudgetFloor
      )
        blocked.push("CAMPAIGN_BUDGET_CAP");
      const delta = e.requestedBudget - e.currentBudget;
      if (
        p.accountDailySpendCap === null ||
        e.accountDailySpend === undefined ||
        e.accountDailySpend + delta > p.accountDailySpendCap
      )
        blocked.push("ACCOUNT_SPEND_CAP");
      if (
        p.monthlySpendCap === null ||
        e.monthSpend === undefined ||
        e.monthSpend + e.requestedBudget > p.monthlySpendCap
      )
        blocked.push("MONTHLY_SPEND_CAP");
    }
  }
  if (
    e.action === "PAUSE_CREATIVE" &&
    (e.activeCreatives === undefined ||
      e.activeCreatives - 1 < policy.creativePolicy.minimumActiveCreatives)
  )
    blocked.push("CREATIVE_CAPACITY");
  if (e.action === "REQUEST_KAI_REFRESH" && !policy.creativePolicy.autoCreativeRefresh)
    blocked.push("CREATIVE_REFRESH_DISABLED");
  if (e.action === "UPDATE_AUDIENCE" && policy.audiencePolicy.mode !== "GUARDED_AUTOMATIC")
    blocked.push("AUDIENCE_REQUIRES_EXPERIMENT_OR_REVIEW");
  if (e.action === "PUBLISH_CREATIVE") {
    if (e.qaPassed !== true) blocked.push("QA_REQUIRED");
    if (e.simulationPassed !== true) blocked.push("SIMULATION_REQUIRED");
    if (e.claimsVerified !== true) blocked.push("CLAIM_VERIFICATION_REQUIRED");
  }
  const requiresApproval =
    blocked.length === 0 &&
    (policy.autonomousMode === "ADVISOR" ||
      policy.autonomousMode === "COPILOT" ||
      policy.safetyPolicy.permissions[e.action] !== "AUTO" ||
      ["ACTIVATE_CAMPAIGN", "FIX_TRACKING"].includes(e.action));
  return {
    allowed: blocked.length === 0 && !requiresApproval,
    requiresApproval,
    blocked,
    policyVersion: e.currentPolicyVersion,
    allowedScalePercent,
    reviewHours: pace.reviewHours,
  };
}

/**
 * EYVRA — SAMANTHA V2 Phase 5. Pure, deterministic, total "decision -> may it auto-proceed" mapping
 * over an already-computed `SamanthaDecision` (Phase 4) and a tenant's `AutomationPolicy` — no I/O,
 * no LLM call, same discipline `decision.ts`/`diagnosis.ts`/`campaign-health.ts` already establish.
 *
 * CRITICAL SCOPE NOTE — read before touching this file: this whole phase produces a
 * `PolicyEvaluation` OBJECT ONLY — it says what a policy WOULD allow, nothing more.
 * `evaluateAutomationPolicy` NEVER enqueues a row to `pending_agent_actions`, NEVER calls
 * `PendingActionsService` (any method), NEVER calls `MetaAdsService.executeVerdict` or any other
 * real Meta/creative mutation, and is NOT wired into any controller, service, or scheduled job in
 * this phase. Wiring this function's real output into the real `pending_agent_actions` queue
 * (adding a new `action_type` there — e.g. something like `APPLY_SAMANTHA_DECISION` — and real
 * execution dispatch for it in `PendingActionsService.approve()`) is EXPLICITLY a separate, future,
 * carefully-scoped phase — this phase produces only the pure decision-support function, exactly
 * like Phase 3 deferred LLM-wiring (`CampaignDiagnosis` -> `LlmService.campaignInsight`) and
 * Phase 4 deferred execution-wiring (`SamanthaDecision` -> `PendingActionsService`/
 * `MetaAdsService.executeVerdict`).
 *
 * `AutomationMode` is reused directly from `growth-objectives/dto/growth-objective.dto.ts` (the
 * real, already-shipped source of truth for this type — `ADVISOR`/`COPILOT`/`AUTOPILOT_GUARDED`/
 * `AUTONOMOUS`) rather than redefined here as a parallel enum with the same meaning.
 */
export interface AutomationPolicy {
  readonly mode: AutomationMode;
  /** 0-1. The minimum `SamanthaDecision.confidence` required before AUTOPILOT_GUARDED/AUTONOMOUS may auto-proceed. */
  readonly minimumConfidence: number;
  /**
   * Only consulted in `AUTOPILOT_GUARDED` mode — the explicit whitelist of `RecommendedActionType`s
   * this tenant has allowed to auto-proceed without a human click. Ignored in every other mode:
   * ADVISOR/COPILOT never auto-act regardless of this list (see rules 2-3 below), and AUTONOMOUS
   * auto-acts on any actionable decision above `minimumConfidence` without being gated by a
   * whitelist at all (see rule 5's own doc for why that is a deliberate design difference, not an
   * oversight).
   */
  readonly allowedAutoActions: readonly RecommendedActionType[];
}

export interface PolicyEvaluation {
  /** true = this decision MAY proceed automatically under this policy — see this module's top doc comment for the critical "evaluation only, never execution" scope boundary. */
  readonly allowed: boolean;
  /** Always the logical negation of `allowed` for an actionable decision; both `false` only for NO_ACTION/MONITOR (nothing to gate). */
  readonly requiresApproval: boolean;
  /** Indonesian, specific — references the real policy mode/confidence/whitelist that produced this result. */
  readonly reason: string;
}

/**
 * `decision.decision` is `NO_ACTION` or `MONITOR` — neither is ever a real mutation, so there is
 * nothing for any policy mode to gate. This early-return is reused regardless of `policy.mode`.
 */
function evaluateNonActionableDecision(decision: SamanthaDecision): PolicyEvaluation {
  return {
    allowed: true,
    requiresApproval: false,
    reason: `Decision "${decision.decision}" tidak pernah berupa mutasi nyata — tidak ada yang perlu digerbang oleh policy apa pun.`,
  };
}

/**
 * `policy.mode === "ADVISOR"` — the raw spec's own definition of Advisor is "prepare only, never
 * act": absolute, not confidence-gated. Every actionable decision always requires human approval.
 */
function evaluateAdvisorMode(): PolicyEvaluation {
  return {
    allowed: false,
    requiresApproval: true,
    reason: "Mode ADVISOR: setiap keputusan wajib direview manusia, tidak pernah otomatis.",
  };
}

/**
 * `policy.mode === "COPILOT"` — Copilot presents recommendations, a human confirms every one.
 * Unlike `AUTOPILOT_GUARDED`, Copilot has no concept of a pre-approved action whitelist at all —
 * `policy.allowedAutoActions` is never even consulted for this mode, because the mode itself never
 * auto-proceeds regardless of what that list contains.
 */
function evaluateCopilotMode(): PolicyEvaluation {
  return {
    allowed: false,
    requiresApproval: true,
    reason:
      "Mode COPILOT: rekomendasi selalu ditampilkan ke manusia untuk dikonfirmasi, tidak ada whitelist auto-action seperti AUTOPILOT_GUARDED.",
  };
}

/**
 * `policy.mode === "AUTOPILOT_GUARDED"` — `allowed: true` only when BOTH real conditions hold:
 * `decision.confidence >= policy.minimumConfidence` AND `policy.allowedAutoActions` includes
 * `decision.decision`. The `reason` string always names WHICH condition(s) failed (confidence too
 * low, action not whitelisted, or both) — never a generic "policy denied it".
 */
function evaluateAutopilotGuardedMode(
  decision: SamanthaDecision,
  policy: AutomationPolicy,
): PolicyEvaluation {
  const confidenceOk = decision.confidence >= policy.minimumConfidence;
  const whitelisted = policy.allowedAutoActions.includes(decision.decision);

  if (confidenceOk && whitelisted) {
    return {
      allowed: true,
      requiresApproval: false,
      reason: `Mode AUTOPILOT_GUARDED: confidence ${String(decision.confidence)} >= minimum ${String(policy.minimumConfidence)} dan action "${decision.decision}" ada di allowedAutoActions — boleh berjalan otomatis.`,
    };
  }

  const failures: string[] = [];
  if (!confidenceOk) {
    failures.push(
      `confidence ${String(decision.confidence)} di bawah minimum ${String(policy.minimumConfidence)}`,
    );
  }
  if (!whitelisted) {
    failures.push(`action "${decision.decision}" tidak ada di allowedAutoActions`);
  }

  return {
    allowed: false,
    requiresApproval: true,
    reason: `Mode AUTOPILOT_GUARDED: ${failures.join(" dan ")} — wajib direview manusia.`,
  };
}

/**
 * `policy.mode === "AUTONOMOUS"` — `allowed: true` when `decision.confidence >=
 * policy.minimumConfidence`; a real, honest safety net — even full autonomy never auto-acts on a
 * low-confidence decision. `policy.allowedAutoActions` is deliberately NOT consulted here: Autonomous
 * means the tenant has explicitly opted out of a per-action whitelist, trusting confidence alone as
 * the gate. This is a real, deliberate design difference from `AUTOPILOT_GUARDED`, not an oversight
 * — AUTOPILOT_GUARDED exists precisely for tenants who want the extra whitelist safety net;
 * AUTONOMOUS exists for tenants who have decided they do not need it.
 */
function evaluateAutonomousMode(
  decision: SamanthaDecision,
  policy: AutomationPolicy,
): PolicyEvaluation {
  const confidenceOk = decision.confidence >= policy.minimumConfidence;

  if (confidenceOk) {
    return {
      allowed: true,
      requiresApproval: false,
      reason: `Mode AUTONOMOUS: confidence ${String(decision.confidence)} >= minimum ${String(policy.minimumConfidence)} — boleh berjalan otomatis tanpa whitelist (AUTONOMOUS tidak memakai allowedAutoActions).`,
    };
  }

  return {
    allowed: false,
    requiresApproval: true,
    reason: `Mode AUTONOMOUS: confidence ${String(decision.confidence)} di bawah minimum ${String(policy.minimumConfidence)} — wajib direview manusia meski mode autonomous.`,
  };
}

/**
 * Deterministic "decision + policy -> may it auto-proceed" mapping — total (every valid
 * `SamanthaDecision`/`AutomationPolicy` pair produces a valid `PolicyEvaluation`), pure, throws
 * nothing.
 *
 * Decision table (evaluated top to bottom):
 *  1. `decision.decision` is `NO_ACTION` or `MONITOR` -> `{allowed: true, requiresApproval: false}`
 *     regardless of `policy.mode` — nothing to gate.
 *  2. `policy.mode === "ADVISOR"` -> always `{allowed: false, requiresApproval: true}`.
 *  3. `policy.mode === "COPILOT"` -> always `{allowed: false, requiresApproval: true}`.
 *  4. `policy.mode === "AUTOPILOT_GUARDED"` -> `allowed: true` only when BOTH
 *     `decision.confidence >= policy.minimumConfidence` AND `policy.allowedAutoActions` includes
 *     `decision.decision`.
 *  5. `policy.mode === "AUTONOMOUS"` -> `allowed: true` when
 *     `decision.confidence >= policy.minimumConfidence` alone; `allowedAutoActions` is not
 *     consulted.
 */
export function evaluateAutomationPolicy(
  decision: SamanthaDecision,
  policy: AutomationPolicy,
): PolicyEvaluation {
  if (decision.decision === "NO_ACTION" || decision.decision === "MONITOR") {
    return evaluateNonActionableDecision(decision);
  }

  switch (policy.mode) {
    case "ADVISOR":
      return evaluateAdvisorMode();
    case "COPILOT":
      return evaluateCopilotMode();
    case "AUTOPILOT_GUARDED":
      return evaluateAutopilotGuardedMode(decision, policy);
    case "AUTONOMOUS":
      return evaluateAutonomousMode(decision, policy);
  }
}
