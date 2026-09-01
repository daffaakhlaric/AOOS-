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

      await this.persistProposal(simulation.tenantId, simulationId, agent, gap, plan);
    } catch (caught) {
      // Best-effort — a learning-proposal-generation failure must NEVER fail or roll back the
      // simulation itself (same discipline `SchedulerService.countHotLeads`/`indexPulledAdAccount`
      // already establish).
      this.logger.warn(
        `LearningService.onSimulationComplete(${simulationId}) failed: ${String(caught)}`,
      );
    }
  }

  private async persistProposal(
    tenantId: string,
    simulationId: string,
    agent: "SAMANTHA" | "CLARA",
    gap: DetectedGap,
    plan: {
      readonly analysis: string;
      readonly improvements: readonly Record<string, unknown>[];
      readonly droppedCount: number;
    },
  ): Promise<LearningProposalRow> {
    if (plan.droppedCount > 0) {
      this.logger.warn(
        `LearningService.onSimulationComplete(${simulationId}): dropped ${plan.droppedCount} improvement(s) whose target wasn't a known prompt_key (${KNOWN_PROMPT_KEYS.join(", ")}).`,
      );
    }
    return this.proposals.create({
      tenantId,
      simulationId,
      agent,
      analysis: plan.analysis,
      gaps: { ...gap },
      improvements: plan.improvements,
    });
  }
}
