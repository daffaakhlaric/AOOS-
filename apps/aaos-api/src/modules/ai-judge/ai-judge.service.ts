import { Injectable, Logger } from "@nestjs/common";

import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { JudgeMemoryService } from "../judge-memory/judge-memory.service.js";
import { LearningService } from "../learning/learning.service.js";
import { LlmService } from "../llm/llm.service.js";

import { JudgeResultRepository } from "./infrastructure/judge-result.repository.js";

const JUDGEABLE_AGENTS = new Set(["SAMANTHA", "KAI", "CLARA"]);

/**
 * `modules/ai-judge` (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2) — a genuinely NEW, small module
 * rather than an extension of `modules/agent-runs`: J1's `AgentRunsModule` is deliberately a small,
 * write-only pointer module with no controller and no real LLM dependency (see its own doc — "no
 * real read caller yet (Phase J2/J3 territory)"); J2 adds a real new table (`judge_results`), a
 * real new repository, and a real `LlmService` dependency — different enough real logic that
 * folding it into `AgentRunsModule` would blur that module's own documented scope, same
 * "don't build a redundant parallel module, but don't force unrelated logic into an existing small
 * one either" discipline this session applies throughout.
 *
 * `judgeRun` is deliberately best-effort end to end, mirroring `AgentRunsService.record`'s own
 * documented discipline: a real judging failure (LLM unavailable, a malformed response, a DB
 * write failure) must NEVER be the reason a real Samantha/Kai/Clara action fails or is retried.
 * Every real call site wires this AFTER its own `AgentRunsService.record(...)` call succeeds — see
 * each call site's own doc for whether it's awaited-detached or synchronous-within-an-already-
 * detached job.
 */
@Injectable()
export class AiJudgeService {
  private readonly logger = new Logger(AiJudgeService.name);

  constructor(
    private readonly agentRuns: AgentRunsService,
    private readonly llmService: LlmService,
    private readonly repository: JudgeResultRepository,
    private readonly learningService: LearningService,
    // AAOS Self-Improving (Phase SI-5) — real, curated Judge Memory, replacing this method's own
    // former inline "last 10 raw overall scores" build (see `JudgeMemoryService`'s own class doc).
    private readonly judgeMemory: JudgeMemoryService,
  ) {}

  /**
   * Loads the real `agent_runs` row for `agentRunId`, calls `LlmService.judgeAgentRun`, and
   * persists a real `judge_results` row.
   *
   * Real, honest degrade decision (documented, per the coordinator note's explicit ask): when the
   * LLM is unavailable (`available: false` — no API key, rate-limited, provider error, or an
   * invalid response), NO `judge_results` row is written at all. A NULL/placeholder-scores row was
   * considered and rejected: `judge_results.scores` is `JSONB NOT NULL` (this table's real shape
   * has no honest way to represent "we didn't actually judge this run" as data — a row with
   * fabricated zeros, or a sentinel the UI has to special-case, is a worse, more confusing signal
   * than simply having no row for this run yet). A caller/dashboard reading `judge_results` for a
   * given `run_id` and finding nothing can already distinguish "not yet judged" from "judged,
   * scored" without a third state.
   */
  async judgeRun(tenantId: string, agentRunId: string): Promise<void> {
    try {
      const run = await this.agentRuns.findById(agentRunId);
      if (run === undefined) {
        this.logger.warn(
          `AiJudgeService.judgeRun(${agentRunId}): agent_runs row not found — skipping.`,
        );
        return;
      }
      if (!JUDGEABLE_AGENTS.has(run.agent)) {
        this.logger.warn(
          `AiJudgeService.judgeRun(${agentRunId}): unknown agent "${run.agent}" — no judge prompt exists for it, skipping.`,
        );
        return;
      }
      const agent = run.agent as "SAMANTHA" | "KAI" | "CLARA";

      // AAOS Self-Improving (Phase SI-5) — real, curated Judge Memory (`JudgeMemoryService`'s own
      // class doc), replacing this method's former inline "last 10 raw overall scores" build.
      const memory = await this.judgeMemory.build(tenantId, agent);

      const result = await this.llmService.judgeAgentRun(tenantId, {
        tenantId,
        agent,
        runRef: run.run_ref,
        runCreatedAt: run.created_at,
        context: (run.context ?? {}) as Record<string, unknown>,
        memory,
      });

      if (!result.available) {
        this.logger.warn(
          `AiJudgeService.judgeRun(${agentRunId}): judgeAgentRun unavailable (${result.reason}) — no judge_results row written (see this method's own doc for why).`,
        );
        return;
      }

      await this.repository.insert({
        tenantId,
        agent,
        runId: agentRunId,
        scores: result.scores,
        strengths: result.strengths,
        gaps: result.gaps,
        notes: result.notes,
      });

      // AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — the real trigger point, wired AFTER this
      // `judge_results` row is successfully persisted (see `LearningService.onAgentRunJudged`'s own
      // doc for why this point, not one of J1's raw `agent_runs.record` call sites, is the real
      // correct trigger — a score to gate on doesn't exist until here). Best-effort, same discipline
      // as this whole method: a proposal-generation failure must never surface past `judgeRun`.
      // `LearningService.onAgentRunJudged` already has its own outer try/catch, but this call is
      // still made from inside `judgeRun`'s own try block for defense in depth.
      await this.learningService.onAgentRunJudged(tenantId, agentRunId, agent, {
        scores: result.scores,
        gaps: result.gaps,
        trend: result.trend,
      });
    } catch (caught) {
      this.logger.warn(`AiJudgeService.judgeRun(${agentRunId}) failed: ${String(caught)}`);
    }
  }
}
