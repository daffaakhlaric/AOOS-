import { Injectable, Logger } from "@nestjs/common";

import { ANALYZE_SYSTEM_PROMPT, KNOWN_PROMPT_KEYS, LlmService } from "../llm/llm.service.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";
import { SIMULATION_CRITERIA } from "../simulation/domain/scoring.js";
import { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import {
  LearningProposalRepository,
  type LearningProposalRow,
} from "./infrastructure/learning-proposal.repository.js";

/**
 * SAMANTHA's real "analyze" prompt (`LlmService.analyze`'s hardcoded fallback constant) is the
 * `currentPromptContent` this module resolves for a SAMANTHA gap — it's the exact real prompt
 * `samanthaCoverageScore` (the score this module checks first, see `detectGap`'s doc) is derived
 * from the response of.
 */
const SAMANTHA_PROMPT_KEY = "analyze";
const CLARA_PROMPT_KEY = "clara_system_prompt";

/**
 * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — the real gap criterion for a LIVE agent run
 * (`LearningService.onAgentRunJudged`'s own doc has the full reasoning). Deliberately NOT
 * `SIMULATION_CRITERIA.minOverallScore` (70) — a real, separate, stricter judgment call for a
 * trigger that fires on every real Samantha/Kai/Clara run, not just a manually-triggered
 * simulation.
 */
const LIVE_RUN_GAP_THRESHOLD = 60;

/**
 * REAL FINDING: `aaos-api` (this app) has no dependency on `packages/sales-agent` — Clara's real
 * hardcoded `SYSTEM_PROMPT_TEMPLATE` constant lives in that separate package and is not reachable
 * from here (confirmed: no `@aos/sales-agent` entry in `apps/aaos-api/package.json`; Phase A's own
 * commit note already documents "no real aaos-api call site" exists for Clara's prompt resolution
 * today). Adding a new cross-package dependency just to import that one constant as a fallback
 * string is out of scope for this phase. `PromptOverrideService.resolve` is still called for real
 * (so a REAL active `CLARA`/`clara_system_prompt` override — if one ever exists — is still honestly
 * returned); this honest, explicitly-labeled placeholder is only ever seen by the LLM when no real
 * override row exists yet, which is the truth for every tenant today (nothing in this codebase has
 * ever created one).
 */
const CLARA_PROMPT_FALLBACK_PLACEHOLDER =
  "[[Prompt asli Clara ada di packages/sales-agent (SYSTEM_PROMPT_TEMPLATE), tidak diakses langsung dari aaos-api. Belum ada active override untuk tenant ini saat ini.]]";

export interface DetectedGap {
  readonly source: "SIMULATION";
  readonly samanthaCoverageScore: number;
  readonly kaiScore: number;
  readonly claraScore: number;
  readonly overallScore: number;
  readonly grade: string;
  readonly verdict: string;
  /**
   * A plain (non-`readonly`) array type — deliberately, to structurally match
   * `ImprovementPlanRequestDto["gap"]["feedbackItems"]`'s Zod-inferred array type
   * (`z.array(...)` infers a mutable array), even though this value is never mutated. The
   * `feedbackItems` PROPERTY itself is still `readonly` (never reassigned).
   */
  readonly feedbackItems: Array<{ dimension: string; message: string }>;
}

/**
 * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — the real LIVE-run sibling of `DetectedGap`, structurally
 * matching `ImprovementPlanRequestDto["gap"]`'s `LiveRunGapSchema` branch (`dto/improvement-plan.dto.ts`'s
 * own doc explains why this is a genuinely separate shape, not a forced fit into `DetectedGap`'s
 * 3-agent triple).
 */
export interface DetectedLiveRunGap {
  readonly source: "LIVE_RUN";
  readonly agent: "SAMANTHA" | "CLARA";
  readonly overallScore: number;
  readonly scores: Record<string, number>;
  readonly trend: "IMPROVING" | "STABLE" | "DECLINING";
  readonly feedbackItems: Array<{ dimension: string; message: string }>;
}

/** Real, minimal shape `LearningService.onAgentRunJudged` needs from a just-persisted `judge_results` row — deliberately NOT the full `JudgeResultRow` (this method has no need for `id`/`created_at`/`run_id`, `AiJudgeService.judgeRun` already has those). */
export interface JudgedRunSummary {
  readonly scores: Record<string, unknown>;
  readonly gaps: readonly unknown[];
  readonly trend: unknown;
}

/**
 * AAOS Self-Learning AI, Phase B — gap detection + LLM-generated improvement PROPOSAL.
 *
 * HARD RULE (confirmed explicitly by the user): nothing in this class ever writes an active
 * `agent_prompt_overrides`/`agent_config_overrides` row. `onSimulationComplete` only ever inserts
 * one `learning_proposals` row with `status: 'PENDING'` — the human-approval write path is Phase C,
 * a separate, later effort.
 *
 * Real wiring point: called BEST-EFFORT from `SimulationService.runPipeline`, right after
 * `SimulationRepository.complete` persists the finished `StoredSimulation` — same "side-check that
 * can't take down the main flow" discipline `SchedulerService.countHotLeads`/`indexPulledAdAccount`
 * already establish elsewhere in this codebase: a learning-proposal-generation failure must NEVER
 * fail or roll back the simulation itself.
 *
 * GAP CRITERION (documented, grounded in `domain/scoring.ts`'s own real fields — NOT the original
 * pasted spec's fictional 75/70/65 per-agent thresholds, per the design doc's Finding #3):
 * `verdict === 'CONDITIONAL' || verdict === 'NO-GO'`. Deliberately EXCLUDES `'GO'` (no gap — the
 * simulation already cleared `SIMULATION_CRITERIA`'s real bar) and `'INCOMPLETE'`
 * (`domain/scoring.ts`'s own doc: "verdict is INCOMPLETE... whenever the Clara/Judge stage produced
 * no completed persona run at all... an incomplete pipeline is a different, honestly-distinct
 * outcome from 'we ran it and it failed the bar'" — an infra/config gap, e.g.
 * `AAOS_SIMULATOR_BASE_URL` unset, is not a prompt-quality signal worth an LLM improvement
 * proposal, and `ClaraPersonaRun.feedbackItems` would be empty for every persona anyway, giving the
 * LLM nothing real to reason over).
 *
 * AGENT ATTRIBUTION (which real agent — SAMANTHA or CLARA — a proposal concerns, since one
 * `learning_proposals` row targets one `agent`): `samanthaCoverageScore <
 * SIMULATION_CRITERIA.minSamanthaScore` attributes to SAMANTHA — a direct, real failure of one of
 * `computeSimulationScoring`'s own two named gate conditions (`overallScore >= minOverallScore &&
 * samanthaCoverageScore >= minSamanthaScore`). Otherwise attributes to CLARA — `domain/scoring.ts`'s
 * own `WEIGHTS` constant weighs Clara heaviest (60%, "the stage with a real, upstream-computed
 * numeric score"), so a CONDITIONAL/NO-GO verdict that didn't fail the explicit Samantha gate is,
 * by construction, most likely driven by `claraScore` — and Clara is the only stage with real
 * qualitative `feedbackItems` judge notes for the LLM to reason over regardless.
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly simulations: SimulationRepository,
    private readonly proposals: LearningProposalRepository,
    private readonly llmService: LlmService,
    private readonly promptOverride: PromptOverrideService,
  ) {}

  async onSimulationComplete(simulationId: string): Promise<void> {
    try {
      const simulation = await this.simulations.findById(simulationId);
      if (simulation === undefined || simulation.result === undefined) {
        this.logger.warn(
          `LearningService.onSimulationComplete(${simulationId}): simulation not found or has no result — skipping.`,
        );
        return;
      }

      const { scoring, clara } = simulation.result;
      if (scoring.verdict !== "CONDITIONAL" && scoring.verdict !== "NO-GO") {
        // No gap — see this class's doc for why GO and INCOMPLETE both intentionally produce no
        // proposal row (design doc's own "no gap -> no proposal" flow).
        return;
      }

      const feedbackItems = clara.runs.flatMap((run) => run.feedbackItems ?? []);
      const gap: DetectedGap = {
        source: "SIMULATION",
        samanthaCoverageScore: scoring.samanthaCoverageScore,
        kaiScore: scoring.kaiScore,
        claraScore: scoring.claraScore,
        overallScore: scoring.overallScore,
        grade: scoring.grade,
        verdict: scoring.verdict,
        feedbackItems,
      };

      const agent =
        scoring.samanthaCoverageScore < SIMULATION_CRITERIA.minSamanthaScore ? "SAMANTHA" : "CLARA";
      const promptKey = agent === "SAMANTHA" ? SAMANTHA_PROMPT_KEY : CLARA_PROMPT_KEY;
      const fallback =
        agent === "SAMANTHA" ? ANALYZE_SYSTEM_PROMPT : CLARA_PROMPT_FALLBACK_PLACEHOLDER;

      const currentPromptContent = await this.promptOverride.resolve(
        simulation.tenantId,
        agent,
        promptKey,
        fallback,
      );

      const recentRows = await this.proposals.listRecentForTenant(simulation.tenantId, 3);
      const recentProposals = recentRows.map((row) => ({
        createdAt: row.created_at,
        agent: row.agent,
        analysis: row.analysis,
        status: row.status,
      }));

      const plan = await this.llmService.generateImprovementPlan(simulation.tenantId, {
        tenantId: simulation.tenantId,
        agent,
        gap,
        currentPromptKey: promptKey,
        currentPromptContent,
        recentProposals,
      });

      if (!plan.available) {
        this.logger.warn(
          `LearningService.onSimulationComplete(${simulationId}): generateImprovementPlan unavailable (${plan.reason}) — no proposal written.`,
        );
        return;
      }

      await this.persistProposal(
        simulation.tenantId,
        `onSimulationComplete(${simulationId})`,
        agent,
        gap,
        plan,
        { simulationId },
      );
    } catch (caught) {
      // Best-effort — a learning-proposal-generation failure must NEVER fail or roll back the
      // simulation itself (same discipline `SchedulerService.countHotLeads`/`indexPulledAdAccount`
      // already establish).
      this.logger.warn(
        `LearningService.onSimulationComplete(${simulationId}) failed: ${String(caught)}`,
      );
    }
  }

  /**
   * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — the LIVE-run sibling of `onSimulationComplete`. Reuses
   * the EXACT SAME `learning_proposals` table, `LlmService.generateImprovementPlan`, and
   * `KNOWN_PROMPT_KEYS` server-side validation `onSimulationComplete` already uses — no new
   * proposal table, no new validation logic, no new LLM call (this method's own body is real,
   * LIVE-run-specific glue, not a second generator).
   *
   * REAL TRIGGER POINT (a deliberate correction of `docs/PROMPT-AAOS-AI-JUDGE-SELF-IMPROVING.md`'s
   * own Phase J3 wording — "wired to Phase J1's 3 real trigger points" — verified against the real
   * code before implementing, per the coordinator's own explicit instruction to do so): this method
   * is called from `AiJudgeService.judgeRun`, immediately AFTER a real `judge_results` row is
   * successfully persisted (`JudgeResultRepository.insert` has already returned) — NOT from J1's 3
   * raw `AgentRunsService.record(...)` call sites (`scheduler.service.ts`/
   * `creative-packages.service.ts`/`closings.service.ts`). Those 3 sites record a run BEFORE it has
   * been judged at all — there is no `overall` score yet to gate a proposal on there, so wiring this
   * trigger at J1's raw record points (the design doc's own literal wording) is not just a stylistic
   * choice but would be impossible to implement honestly: you cannot threshold a score that does not
   * exist yet. `judgeRun`'s own real completion (after its own real LLM judgment, after its own real
   * DB write) is the one genuine point in this codebase where a real, below-threshold `overall`
   * score exists to react to.
   *
   * GAP CRITERION, LIVE RUNS (a real, documented judgment call — NOT a blind copy of
   * `SIMULATION_CRITERIA.minOverallScore` (70), same transparency discipline that constant's own
   * comment models): `overall < LIVE_RUN_GAP_THRESHOLD` (60). `judgeAgentRun`'s `overall` score is
   * genuinely on the SAME real 0-100 scale for all 3 agents (every one of
   * `SamanthaJudgeScoresSchema`/`KaiJudgeScoresSchema`/`ClaraJudgeScoresSchema`'s own `overall`
   * field is `z.number().min(0).max(100)`, `dto/judge-agent-run.dto.ts`) — so reusing that numeric
   * SCALE isn't itself dishonest. But the THRESHOLD value is deliberately not copied from
   * `SIMULATION_CRITERIA`: a live run fires far more often than a manually-triggered simulation
   * (every real Samantha analyze run / Kai creative-package generation / Clara conversation
   * reaching a terminal state), so gating at the simulation's own generous 70 (already only a "C"
   * grade or below on `domain/scoring.ts`'s own `toGrade` bands) would flood the Learning Monitor
   * with a proposal for nearly every run that isn't outright excellent. 60 ("D"/"F" territory) is
   * chosen as a real, stricter bar suited to a HIGH-FREQUENCY trigger — only a genuinely poor run
   * proposes a change. This is further supported by each per-agent judge schema's own real
   * `trend_consistency`/`ai_availability`/etc. dimensions already reflecting the tenant+agent's last
   * 10 real judge_results as memory context (`AiJudgeService.judgeRun`'s own `memory.recent`), so a
   * single-run `overall` already carries some real smoothing against one noisy outlier before this
   * method ever sees it.
   *
   * KAI IS DELIBERATELY EXCLUDED, same real precedent `onSimulationComplete`'s own doc already
   * establishes ("Kai has no chat-LLM prompt") — re-verified here directly: `LlmService.
   * generateImprovementPlan`'s own `ImprovementPlanRequestDto["agent"]` is `z.enum(["SAMANTHA",
   * "CLARA"])`, never 3-way, and this codebase's real `creative_brief`/`generate_caption`/
   * `generate_hashtags` prompt keys all resolve under the SAMANTHA `agent_prompt_overrides` bucket
   * (verified directly against `LlmService.generateCreativeBrief`'s own real
   * `promptOverride.resolve(tenantId, SAMANTHA_AGENT, "creative_brief", ...)` call) — there is no
   * real "KAI" agent bucket a proposal could honestly target today. Widening
   * `generateImprovementPlan`'s own Zod agent enum to a real 3rd agent is real, additional, untested
   * surface this phase does not need; a KAI-judged below-threshold run is logged and skipped, never
   * silently forced through the SAMANTHA bucket under a misleading "KAI" label.
   */
  async onAgentRunJudged(
    tenantId: string,
    agentRunId: string,
    agent: string,
    judged: JudgedRunSummary,
  ): Promise<void> {
    try {
      if (agent !== "SAMANTHA" && agent !== "CLARA") {
        this.logger.warn(
          `LearningService.onAgentRunJudged(${agentRunId}): agent "${agent}" has no known learning-proposal prompt key — skipping (see this method's own doc for why KAI is excluded).`,
        );
        return;
      }
      // Safe: narrowed by the guard above (a plain `string` param, not narrowed automatically by
      // TS's negated-literal control flow, so made explicit here rather than left implicit).
      const knownAgent: "SAMANTHA" | "CLARA" = agent;

      const overallRaw = judged.scores["overall"];
      if (typeof overallRaw !== "number") {
        this.logger.warn(
          `LearningService.onAgentRunJudged(${agentRunId}): judge_results.scores has no numeric "overall" — skipping.`,
        );
        return;
      }
      if (overallRaw >= LIVE_RUN_GAP_THRESHOLD) {
        // No gap — see this method's own doc for why 60 (not SIMULATION_CRITERIA's 70) is the real
        // chosen bar for a high-frequency LIVE-run trigger.
        return;
      }

      const scores: Record<string, number> = {};
      for (const [key, value] of Object.entries(judged.scores)) {
        if (typeof value === "number") {
          scores[key] = value;
        }
      }

      const feedbackItems = judged.gaps
        .filter(
          (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
        )
        .map((item) => {
          const dimension = typeof item["dimension"] === "string" ? item["dimension"] : "unknown";
          const issue = typeof item["issue"] === "string" ? item["issue"] : "";
          const suggestion = typeof item["suggestion"] === "string" ? item["suggestion"] : "";
          const message =
            suggestion.length > 0
              ? `${issue} — Saran: ${suggestion}`
              : issue || "(tidak ada detail)";
          return { dimension, message };
        });

      const trend =
        judged.trend === "IMPROVING" || judged.trend === "DECLINING" ? judged.trend : "STABLE";

      const gap: DetectedLiveRunGap = {
        source: "LIVE_RUN",
        agent: knownAgent,
        overallScore: overallRaw,
        scores,
        trend,
        feedbackItems,
      };

      const promptKey = knownAgent === "SAMANTHA" ? SAMANTHA_PROMPT_KEY : CLARA_PROMPT_KEY;
      const fallback =
        knownAgent === "SAMANTHA" ? ANALYZE_SYSTEM_PROMPT : CLARA_PROMPT_FALLBACK_PLACEHOLDER;

      const currentPromptContent = await this.promptOverride.resolve(
        tenantId,
        knownAgent,
        promptKey,
        fallback,
      );

      // Same real memory pattern `onSimulationComplete` already uses (Phase B) — no separate query,
      // no separate table: the tenant's last 3 `learning_proposals` rows regardless of trigger
      // source (simulation- or live-run-triggered).
      const recentRows = await this.proposals.listRecentForTenant(tenantId, 3);
      const recentProposals = recentRows.map((row) => ({
        createdAt: row.created_at,
        agent: row.agent,
        analysis: row.analysis,
        status: row.status,
      }));

      const plan = await this.llmService.generateImprovementPlan(tenantId, {
        tenantId,
        agent: knownAgent,
        gap,
        currentPromptKey: promptKey,
        currentPromptContent,
        recentProposals,
      });

      if (!plan.available) {
        this.logger.warn(
          `LearningService.onAgentRunJudged(${agentRunId}): generateImprovementPlan unavailable (${plan.reason}) — no proposal written.`,
        );
        return;
      }

      await this.persistProposal(
        tenantId,
        `onAgentRunJudged(${agentRunId})`,
        knownAgent,
        gap,
        plan,
        { agentRunId },
      );
    } catch (caught) {
      // Best-effort — same discipline `onSimulationComplete`/`AgentRunsService.record`/
      // `AiJudgeService.judgeRun` all already establish: a learning-proposal-generation failure at
      // this trigger point must NEVER be the reason `judgeRun` (or the real underlying Samantha/
      // Kai/Clara action several layers up) fails.
      this.logger.warn(`LearningService.onAgentRunJudged(${agentRunId}) failed: ${String(caught)}`);
    }
  }

  private async persistProposal(
    tenantId: string,
    logLabel: string,
    agent: "SAMANTHA" | "CLARA",
    gap: DetectedGap | DetectedLiveRunGap,
    plan: {
      readonly analysis: string;
      readonly improvements: readonly Record<string, unknown>[];
      readonly droppedCount: number;
    },
    source: { readonly simulationId: string } | { readonly agentRunId: string },
  ): Promise<LearningProposalRow> {
    if (plan.droppedCount > 0) {
      this.logger.warn(
        `LearningService.${logLabel}: dropped ${plan.droppedCount} improvement(s) whose target wasn't a known prompt_key (${KNOWN_PROMPT_KEYS.join(", ")}).`,
      );
    }
    return this.proposals.create({
      tenantId,
      agent,
      analysis: plan.analysis,
      gaps: { ...gap },
      improvements: plan.improvements,
      ...source,
    });
  }
}
