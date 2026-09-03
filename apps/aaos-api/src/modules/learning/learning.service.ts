import { Injectable, Logger, Optional } from "@nestjs/common";

import { AgentConfigService } from "../agent-config/agent-config.service.js";
import { ConfigApplierService } from "../agent-config/config-applier.service.js";
import { LogicApplierService } from "../agent-config/logic-applier.service.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { ImprovementItemSchema, type ImprovementItem } from "../llm/dto/improvement-plan.dto.js";
import {
  ANALYZE_SYSTEM_PROMPT,
  KNOWN_CONFIG_KEYS,
  KNOWN_LOGIC_KEYS,
  KNOWN_PROMPT_KEYS,
  LlmService,
} from "../llm/llm.service.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";
import { SandboxService } from "../sandbox/sandbox.service.js";
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
 *
 * AAOS Self-Improving, Phase SI-1: this literal is now only the real, honest DEFAULT —
 * `onAgentRunJudged` resolves the real value via `AgentConfigService.get(tenantId, "GLOBAL",
 * "live_run_gap_threshold", LIVE_RUN_GAP_THRESHOLD)`. `"GLOBAL"`, not `"SAMANTHA"`/`"CLARA"`, is
 * the real, deliberate bucket choice — this ONE threshold gates BOTH agents' live-run trigger (see
 * this method's own KAI-exclusion doc for why only 2 agents reach it), so no single per-agent
 * bucket would be honest; `034_agent_configs.sql`'s own seed row uses the exact same `"GLOBAL"`
 * bucket and this exact literal value (60) — zero behavior change until a real override row exists.
 */
const LIVE_RUN_GAP_THRESHOLD = 60;

/** The real `agent_configs.agent` bucket for `live_run_gap_threshold` — see that constant's own doc for why no single per-agent bucket is honest here. */
const LIVE_RUN_GAP_THRESHOLD_AGENT_BUCKET = "GLOBAL";

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
    // AAOS Self-Improving (Phase SI-1) — real, DB-backed `live_run_gap_threshold` config, resolved
    // in `onAgentRunJudged` (see `LIVE_RUN_GAP_THRESHOLD`'s own doc).
    private readonly agentConfig: AgentConfigService,
    // AAOS Self-Improving (Phase SI-1) — real, AUTOMATIC (no human gate) CONFIG_UPDATE apply path,
    // called from `persistProposal` right after a proposal row is created (see that method's own
    // doc and `ConfigApplierService`'s own class doc for the full reasoning).
    private readonly configApplier: ConfigApplierService,
    // AAOS Self-Improving (Phase SI-2) — real, AUTOMATIC (no human gate) LOGIC_UPDATE apply path,
    // the exact `agent_logic` sibling of `configApplier` above, called from the SAME
    // `persistProposal` step (see `LogicApplierService`'s own class doc for the full reasoning).
    private readonly logicApplier: LogicApplierService,
    // AAOS Self-Improving (Phase SI-5) — real, AUTOMATIC (no human gate) PROMPT_UPDATE apply path,
    // gated by `SandboxService.testImprovement`'s narrow, honest safety net (see that class's own
    // updated doc and `persistProposal`'s own doc below for the full reasoning).
    private readonly sandboxService: SandboxService,
    // AAOS Self-Improving (Phase SI-6) — real "latest judged run" lookup for
    // `triggerManualCheck`'s own real "Improve sekarang" manual-trigger path (see that method's own
    // doc). Composed by `LearningModule` directly over the shared `SUPABASE_CLIENT`, same reasoning
    // that module's own doc gives. `@Optional()`, unlike every other constructor dependency above,
    // deliberately: every existing real/test call site that constructs `LearningService` directly
    // predates this phase and does not pass this 8th argument (`learning.service.spec.ts` has 20+
    // such real call sites) — making it required would force a mechanical, meaning-free edit to
    // every one of them for a dependency only `triggerManualCheck` (a genuinely NEW method) needs.
    // `LearningModule`'s real DI wiring always provides a real instance in production; only a
    // directly-`new`-constructed test instance that never calls `triggerManualCheck` may omit it.
    @Optional() private readonly judgeResults?: JudgeResultRepository,
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

      const selfAnalysis = await this.runSelfAnalysis(
        `onSimulationComplete(${simulationId})`,
        simulation.tenantId,
        agent,
        gap,
        promptKey,
        currentPromptContent,
        recentProposals,
      );

      const plan = await this.llmService.generateImprovementPlan(simulation.tenantId, {
        tenantId: simulation.tenantId,
        agent,
        gap,
        currentPromptKey: promptKey,
        currentPromptContent,
        recentProposals,
        selfAnalysis,
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
        selfAnalysis,
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
      // AAOS Self-Improving (Phase SI-1) — real, DB-backed override, falling back to the exact same
      // hardcoded `LIVE_RUN_GAP_THRESHOLD` (60) when no tenant override row exists yet — zero
      // behavior change until a real `agent_configs` row is customized (`AgentConfigService.get`'s
      // own doc; `LIVE_RUN_GAP_THRESHOLD`'s own doc for why the "GLOBAL" bucket is used).
      const gapThreshold = await this.agentConfig.get(
        tenantId,
        LIVE_RUN_GAP_THRESHOLD_AGENT_BUCKET,
        "live_run_gap_threshold",
        LIVE_RUN_GAP_THRESHOLD,
      );
      if (overallRaw >= gapThreshold) {
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

      const selfAnalysis = await this.runSelfAnalysis(
        `onAgentRunJudged(${agentRunId})`,
        tenantId,
        knownAgent,
        gap,
        promptKey,
        currentPromptContent,
        recentProposals,
      );

      const plan = await this.llmService.generateImprovementPlan(tenantId, {
        tenantId,
        agent: knownAgent,
        gap,
        currentPromptKey: promptKey,
        currentPromptContent,
        recentProposals,
        selfAnalysis,
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
        selfAnalysis,
      );
    } catch (caught) {
      // Best-effort — same discipline `onSimulationComplete`/`AgentRunsService.record`/
      // `AiJudgeService.judgeRun` all already establish: a learning-proposal-generation failure at
      // this trigger point must NEVER be the reason `judgeRun` (or the real underlying Samantha/
      // Kai/Clara action several layers up) fails.
      this.logger.warn(`LearningService.onAgentRunJudged(${agentRunId}) failed: ${String(caught)}`);
    }
  }

  /**
   * AAOS Self-Improving, Phase SI-3 — real, BEST-EFFORT wrapper around `LlmService.selfAnalyze`,
   * called from both `onSimulationComplete`/`onAgentRunJudged` FIRST, BEFORE `generateImprovementPlan`,
   * over the SAME real gap/prompt/history context those methods already assembled (no second,
   * parallel data-fetching path — see `LlmService.selfAnalyze`'s own doc). Returns `undefined`
   * (NEVER throws) whenever self-analysis is unavailable or degraded in any way — a real `available:
   * false` response, OR the call itself throwing — so `generateImprovementPlan` always proceeds
   * exactly as it did before this phase in that case. Self-analysis is a real ENHANCEMENT to plan
   * quality (its output, when present, is passed into `generateImprovementPlan`'s
   * `body.selfAnalysis`), never a new gate that could block proposal generation.
   */
  private async runSelfAnalysis(
    logLabel: string,
    tenantId: string,
    agent: "SAMANTHA" | "CLARA",
    gap: DetectedGap | DetectedLiveRunGap,
    promptKey: string,
    currentPromptContent: string,
    recentProposals: {
      createdAt: string;
      agent: string;
      analysis: string | null;
      status: string;
    }[],
  ): Promise<{ rootCauses: string[]; patterns: string; confidence: number } | undefined> {
    try {
      const analysis = await this.llmService.selfAnalyze(tenantId, {
        tenantId,
        agent,
        gap,
        currentPromptKey: promptKey,
        currentPromptContent,
        recentProposals,
      });
      if (!analysis.available) {
        this.logger.warn(
          `LearningService.${logLabel}: selfAnalyze unavailable (${analysis.reason}) — proceeding without self-analysis context (best-effort, never blocks proposal generation).`,
        );
        return undefined;
      }
      return {
        rootCauses: [...analysis.rootCauses],
        patterns: analysis.patterns,
        confidence: analysis.confidence,
      };
    } catch (caught) {
      // Best-effort — same discipline every other side-effect in this codebase follows: a
      // self-analysis failure must NEVER be the reason a proposal fails to generate.
      this.logger.warn(
        `LearningService.${logLabel}: selfAnalyze failed — proceeding without self-analysis context (best-effort, never blocks proposal generation): ${String(caught)}`,
      );
      return undefined;
    }
  }

  /**
   * Creates the real `learning_proposals` row, THEN (AAOS Self-Improving, Phase SI-1/SI-2/SI-5) —
   * for every real, Zod-validated `CONFIG_UPDATE`/`LOGIC_UPDATE`/`PROMPT_UPDATE` item in
   * `plan.improvements` — auto-applies it, AUTOMATICALLY, with NO human approval step (the user's
   * own explicit, twice-confirmed decision — see `ConfigApplierService`'s own class doc). The
   * proposal row itself is ALWAYS created first and kept, real and unmodified in its
   * `improvements`/`gaps`/`analysis` — this is real, honest audit/visibility, matching this whole
   * codebase's own transparency discipline, never skipped just because an item auto-applies.
   *
   * AAOS Self-Improving, Phase SI-5's real, additive change: a `PROMPT_UPDATE` item is no longer
   * exclusively human-gated (`LearningDecisionService.approve`). It now ALSO auto-applies here, the
   * exact same way `CONFIG_UPDATE`/`LOGIC_UPDATE` already do — UNLESS
   * `SandboxService.testImprovement` returns a real, honest NEGATIVE signal for it (`available:
   * true`, `delta < 0` — see that class's own updated doc for exactly what this can and cannot
   * measure). Only SAMANTHA `PROMPT_UPDATE(target="analyze")` is honestly testable; every other
   * `agent`/`target` combination degrades (`available: false`) and — per the explicit instruction
   * this phase was built under — an ABSENT signal is never treated as a reason to block, only a real
   * negative one is. A blocked item is recorded on `sandbox_blocked_items` (with the real
   * `SandboxTestResult` that caused the block) and left UN-applied — `LearningDecisionService.approve`
   * still exists, UNCHANGED, as the real human-override route for a blocked item (see that service's
   * own updated doc for how it avoids double-applying an item this method already applied).
   *
   * `auto_applied_config_keys`/`sandbox_blocked_items` + `status` are then written via a real,
   * SECOND, best-effort update (`markAutoApplied`) — see `035_learning_proposals_auto_applied.sql`'s
   * own header doc for the full "why additive columns, not overloading `status`" reasoning, extended
   * by `039_learning_proposals_sandbox_gate.sql`. `status` becomes:
   *   - `'AUTO_APPLIED'` when EVERY improvement item was successfully applied (no item left
   *     genuinely pending human review, and nothing was sandbox-blocked);
   *   - `'AUTO_APPLY_BLOCKED_BY_SANDBOX'` (Phase SI-5) when every item is EITHER successfully
   *     applied OR honestly sandbox-blocked (no item failed to parse/write for any OTHER real
   *     reason) — a real, distinct signal from a bare `'PENDING'`;
   *   - `'PENDING'` otherwise — a malformed item, or a genuine write failure, leaves real,
   *     undifferentiated work for a human, honestly.
   *
   * BEST-EFFORT DISCIPLINE (same as every other side-effect in this codebase): the WHOLE
   * auto-apply-and-record step is wrapped in try/catch — a failure here (an applier/sandbox write
   * error, or the `markAutoApplied` write itself failing) is logged and swallowed, NEVER thrown —
   * the proposal row created above always stands regardless.
   */
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
    // AAOS Self-Improving (Phase SI-3) — real, optional output of the SAME gap's PRIOR
    // `LlmService.selfAnalyze` call (see `runSelfAnalysis`'s own doc). `undefined` when
    // self-analysis wasn't run or was unavailable — persisted as `null`, never fabricated.
    selfAnalysis?: {
      readonly rootCauses: string[];
      readonly patterns: string;
      readonly confidence: number;
    },
  ): Promise<LearningProposalRow> {
    if (plan.droppedCount > 0) {
      this.logger.warn(
        `LearningService.${logLabel}: dropped ${plan.droppedCount} improvement(s) whose target wasn't a known prompt_key (${KNOWN_PROMPT_KEYS.join(", ")}), config_key (${KNOWN_CONFIG_KEYS.join(", ")}), or logic_key (${KNOWN_LOGIC_KEYS.join(", ")}).`,
      );
    }
    const created = await this.proposals.create({
      tenantId,
      agent,
      selfAnalysis,
      analysis: plan.analysis,
      gaps: { ...gap },
      improvements: plan.improvements,
      ...source,
    });

    try {
      const parsedItems: ImprovementItem[] = [];
      for (const raw of plan.improvements) {
        const parsed = ImprovementItemSchema.safeParse(raw);
        if (parsed.success) {
          parsedItems.push(parsed.data);
        }
      }
      const configItems = parsedItems.filter((item) => item.type === "CONFIG_UPDATE");
      // AAOS Self-Improving (Phase SI-2) — the exact LOGIC_UPDATE sibling of `configItems` above,
      // applied via `this.logicApplier.applyLogicUpdate` the SAME automatic, no-human-gate,
      // best-effort way (see `LogicApplierService`'s own class doc).
      const logicItems = parsedItems.filter((item) => item.type === "LOGIC_UPDATE");
      // AAOS Self-Improving (Phase SI-5) — the real, sandbox-gated PROMPT_UPDATE sibling of
      // `configItems`/`logicItems` above (see this method's own doc for the full reasoning).
      const promptItems = parsedItems.filter((item) => item.type === "PROMPT_UPDATE");

      if (configItems.length > 0 || logicItems.length > 0 || promptItems.length > 0) {
        const appliedKeys: string[] = [];
        const sandboxBlockedItems: Record<string, unknown>[] = [];
        // Real, honest "nothing left pending for a human" check — every parsed improvement item on
        // this proposal must be a real CONFIG_UPDATE/LOGIC_UPDATE/PROMPT_UPDATE item (any
        // unparsed/malformed raw item disqualifies both real outcomes below).
        const allItemsParsedAndKnownType =
          parsedItems.length === plan.improvements.length &&
          configItems.length + logicItems.length + promptItems.length === parsedItems.length;
        // `true` only while every item so far either applied successfully OR was honestly
        // sandbox-blocked — a GENUINE write failure (unknown key, malformed logic, a real DB error)
        // sets this `false` and can never be undone by a later item succeeding.
        let hadGenuineFailure = !allItemsParsedAndKnownType;
        let anySandboxBlocked = false;

        for (const item of configItems) {
          const result = await this.configApplier.applyConfigUpdate(tenantId, item);
          if (result.applied) {
            appliedKeys.push(item.target);
          } else {
            hadGenuineFailure = true;
          }
        }

        for (const item of logicItems) {
          const result = await this.logicApplier.applyLogicUpdate(tenantId, item);
          if (result.applied) {
            appliedKeys.push(item.target);
          } else {
            hadGenuineFailure = true;
          }
        }

        // AAOS Self-Improving (Phase SI-5) — real, sandbox-gated PROMPT_UPDATE auto-apply. A
        // SIMULATION-triggered gap (`onSimulationComplete`) has no real `agent_runs.id` of its own
        // — `undefined` here makes `SandboxService.testImprovement` fall back to the tenant+agent's
        // real most-recent run (see that method's own updated doc); a LIVE-run-triggered gap
        // (`onAgentRunJudged`) always has one, passed through directly.
        const baselineAgentRunId = "agentRunId" in source ? source.agentRunId : undefined;
        for (const item of promptItems) {
          const sandboxResult = await this.sandboxService.testImprovement(
            tenantId,
            item.agent,
            item,
            baselineAgentRunId,
          );
          const blockedBySandbox =
            sandboxResult.available && sandboxResult.delta !== null && sandboxResult.delta < 0;
          if (blockedBySandbox) {
            anySandboxBlocked = true;
            sandboxBlockedItems.push({
              agent: item.agent,
              target: item.target,
              result: sandboxResult,
            });
            this.logger.warn(
              `LearningService.${logLabel}: PROMPT_UPDATE ${item.agent}/${item.target} auto-apply BLOCKED by SandboxService (delta=${String(sandboxResult.delta)} < 0) — left un-applied, human can still force via LearningDecisionService.approve.`,
            );
            continue;
          }
          try {
            await this.promptOverride.applyApproved(tenantId, item.agent, item.target, item.after);
            appliedKeys.push(item.target);
            this.logger.log(
              `LearningService.${logLabel}: PROMPT_UPDATE ${item.agent}/${item.target} AUTO-APPLIED (sandbox: ${sandboxResult.available ? `delta=${String(sandboxResult.delta)}` : `unavailable (${sandboxResult.reason})`}) — no human approval, per the user's own confirmed decision.`,
            );
          } catch (caught) {
            hadGenuineFailure = true;
            this.logger.warn(
              `LearningService.${logLabel}: PROMPT_UPDATE ${item.agent}/${item.target} auto-apply write failed — best-effort, proposal stands: ${String(caught)}`,
            );
          }
        }

        const newStatus: "PENDING" | "AUTO_APPLIED" | "AUTO_APPLY_BLOCKED_BY_SANDBOX" =
          hadGenuineFailure
            ? "PENDING"
            : anySandboxBlocked
              ? "AUTO_APPLY_BLOCKED_BY_SANDBOX"
              : "AUTO_APPLIED";

        if (appliedKeys.length > 0 || sandboxBlockedItems.length > 0) {
          await this.proposals.markAutoApplied(
            created.id,
            appliedKeys,
            newStatus,
            sandboxBlockedItems,
          );
        }
      }
    } catch (caught) {
      // Best-effort — a CONFIG_UPDATE/LOGIC_UPDATE auto-apply/record failure must NEVER undo or
      // fail the proposal that was already created above (same discipline every other side-effect
      // in this codebase follows).
      this.logger.warn(
        `LearningService.${logLabel}: auto-apply CONFIG_UPDATE/LOGIC_UPDATE step failed for proposal ${created.id} — best-effort, proposal itself stands: ${String(caught)}`,
      );
    }

    return created;
  }

  /**
   * AAOS Self-Improving, Phase SI-6 — the real "Improve sekarang" manual-trigger path, called from
   * `LearningController.triggerManualCheck` (the Learning Monitor's real manual-trigger button).
   *
   * REAL, HONEST DESIGN (never a fabricated/forced proposal): this does NOT run a new live agent
   * call or a new judge call on demand — it re-runs the EXACT SAME real gap-check-then-propose logic
   * `onAgentRunJudged` already uses (same gap threshold, same `generateImprovementPlan` call), but
   * against the tenant+agent's own MOST RECENTLY ALREADY-JUDGED real run
   * (`JudgeResultRepository.listRecentForTenant(tenantId, agent, 1)`) instead of waiting for the next
   * real live run to cross the threshold on its own. A manager can use this to force a fresh
   * improvement-proposal attempt right now, over real, already-collected data, without inventing a
   * new agent invocation or a new scoring mechanism.
   *
   * HONEST LIMITATION, documented rather than hidden: `judge_results` does not persist the
   * `trend` (`IMPROVING`/`STABLE`/`DECLINING`) `AiJudgeService.judgeRun` computes at judge-time from
   * its own in-memory `memory.recent` context — that value is never written to a column. Since this
   * method reconstructs a `JudgedRunSummary` from an ALREADY-PERSISTED row rather than a live judge
   * call, it cannot honestly recover the real trend that was computed at the time — `"STABLE"` is
   * used as an explicit, documented, honest placeholder (never `"IMPROVING"`/`"DECLINING"`, which
   * would be a fabricated claim about a comparison this method never actually performed).
   * `generateImprovementPlan`'s own prompt only ever uses `trend` as a mild qualitative hint, not a
   * gating condition, so this placeholder does not change WHETHER a proposal is generated, only a
   * minor piece of LLM-facing framing text.
   *
   * Returns a real, honest outcome — `triggered: false` (with a `reason`) when there is no real
   * judged run yet, or the latest one no longer shows a real gap (already at/above the threshold);
   * `triggered: true` when a real gap was found and the SAME best-effort `onAgentRunJudged` pipeline
   * was invoked (which itself never throws — any downstream failure, e.g. the LLM being unavailable,
   * is logged there and does not surface here as an error, same best-effort discipline as every real
   * live trigger).
   */
  async triggerManualCheck(
    tenantId: string,
    agent: string,
  ): Promise<{ readonly triggered: boolean; readonly reason?: string }> {
    if (agent !== "SAMANTHA" && agent !== "CLARA") {
      return {
        triggered: false,
        reason: `Agent "${agent}" has no known learning-proposal prompt key (only SAMANTHA/CLARA are supported — see onAgentRunJudged's own doc for why KAI is excluded).`,
      };
    }
    if (this.judgeResults === undefined) {
      // Real, honest degrade — see this constructor param's own doc: only reachable if
      // `LearningService` was constructed directly without real DI wiring, never in the real app.
      this.logger.warn(
        `LearningService.triggerManualCheck(${tenantId}, ${agent}): no JudgeResultRepository configured — cannot look up the latest real judged run.`,
      );
      return { triggered: false, reason: "JudgeResultRepository not configured." };
    }

    const recent = await this.judgeResults.listRecentForTenant(tenantId, agent, 1);
    if (recent.length === 0) {
      return {
        triggered: false,
        reason: `No real judge_results row exists yet for tenant "${tenantId}" agent "${agent}" — nothing to re-check.`,
      };
    }
    const latest = recent[recent.length - 1];
    if (latest === undefined) {
      return { triggered: false, reason: "Unexpected: listRecentForTenant returned an empty row." };
    }

    const overallRaw = latest.scores["overall"];
    if (typeof overallRaw !== "number") {
      return {
        triggered: false,
        reason: `Latest real judge_results row (${latest.id}) has no numeric "overall" score.`,
      };
    }

    const gapThreshold = await this.agentConfig.get(
      tenantId,
      LIVE_RUN_GAP_THRESHOLD_AGENT_BUCKET,
      "live_run_gap_threshold",
      LIVE_RUN_GAP_THRESHOLD,
    );
    if (overallRaw >= gapThreshold) {
      return {
        triggered: false,
        reason: `Latest real judged run (score ${String(overallRaw)}) already meets the quality bar (threshold ${String(gapThreshold)}) — no gap to propose an improvement for.`,
      };
    }

    const gaps = Array.isArray(latest.gaps) ? latest.gaps : [];
    const judged: JudgedRunSummary = {
      scores: latest.scores,
      gaps,
      // See this method's own doc for why "STABLE" is the one honest placeholder here.
      trend: "STABLE",
    };

    await this.onAgentRunJudged(tenantId, latest.run_id, agent, judged);
    return { triggered: true };
  }
}
