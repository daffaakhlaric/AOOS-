import { Injectable, Logger } from "@nestjs/common";

import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { LlmService } from "../llm/llm.service.js";

import { JudgeResultRepository } from "./infrastructure/judge-result.repository.js";

const JUDGEABLE_AGENTS = new Set(["SAMANTHA", "KAI", "CLARA"]);

/** A real, honestly-computed average of `overall` scores — `null` (never `0`) when `values` is empty. */
function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

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

      const recentRows = await this.repository.listRecentForTenant(tenantId, agent, 10);
      const recent = recentRows.map((row) => ({
        createdAt: row.created_at,
        overall: extractOverall(row.scores),
      }));
      const overallValues = recent
        .map((entry) => entry.overall)
        .filter((value): value is number => value !== undefined);

      const result = await this.llmService.judgeAgentRun(tenantId, {
        tenantId,
        agent,
        runRef: run.run_ref,
        runCreatedAt: run.created_at,
        context: (run.context ?? {}) as Record<string, unknown>,
        memory: {
          recent: recent.map((entry) => ({
            createdAt: entry.createdAt,
            overall: entry.overall ?? 0,
          })),
          averageOverall: average(overallValues),
        },
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
    } catch (caught) {
      this.logger.warn(`AiJudgeService.judgeRun(${agentRunId}) failed: ${String(caught)}`);
    }
  }
}

/** Reads a real, previously-persisted `overall` score out of a `judge_results.scores` JSONB blob — `undefined` (never `0`) when the shape is unexpected. */
function extractOverall(scores: Record<string, unknown>): number | undefined {
  const overall = scores["overall"];
  return typeof overall === "number" ? overall : undefined;
}
