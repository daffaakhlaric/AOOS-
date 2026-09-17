import type {
  RecommendedActionType,
  SamanthaDecision,
} from "../../campaign-health/domain/decision.js";
import type { AutomationMode } from "../../growth-objectives/dto/growth-objective.dto.js";

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
