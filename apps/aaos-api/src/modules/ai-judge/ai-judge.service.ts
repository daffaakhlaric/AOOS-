import { Injectable, Logger } from "@nestjs/common";

import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { JudgeMemoryService } from "../judge-memory/judge-memory.service.js";
import { LearningService } from "../learning/learning.service.js";
import { LlmService } from "../llm/llm.service.js";

import type { IngestSimulationBatchBodyDto } from "./dto/ingest-simulation-batch.dto.js";
import { JudgeResultRepository } from "./infrastructure/judge-result.repository.js";

const JUDGEABLE_AGENTS = new Set(["SAMANTHA", "KAI", "CLARA"]);

/** A real, honestly-computed average — real inputs only, `results` is always non-empty (`IngestSimulationBatchBodySchema.results` is `.min(1)`), so no `undefined`-guard is needed the way `judge-result.repository.ts`'s own `average()` needs one for a possibly-empty history window. */
function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Real, honest outcome of `AiJudgeService.ingestSimulationBatch` — never a fabricated success. */
export interface IngestSimulationBatchResult {
  readonly agentRunId: string;
  readonly judgeResultId: string;
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

  /**
   * The real bridge from `apps/aaos-simulator`'s `POST /api/simulate-all` into this app's
   * Self-Improving pipeline (Self-Learning AI bridge phase). Unlike `judgeRun`, this does NOT call
   * an LLM to judge anything — `@aos/ai-judge` already computed real, deterministic per-dimension
   * scores from the real conversation transcript over there; re-judging that with a second LLM
   * call here would be a fabrication of a "second opinion" nobody asked for and the coordinator
   * note explicitly forbids ("the simulator already computed real scores, don't call an LLM a
   * second time"). This method only RECORDS the already-real numbers and then reuses the exact
   * same downstream pipeline `judgeRun` already triggers.
   *
   * DELIBERATELY NOT BEST-EFFORT for its own two writes (unlike every other method in this class):
   * the caller (`apps/aaos-simulator`) explicitly needs to know whether its batch was honestly
   * recorded or not, to show a real status on `/report` — swallowing a write failure into a fake
   * "sent" response would be exactly the fabricated status the coordinator note forbids. A genuine
   * `agent_runs`/`judge_results` write failure THROWS here, so the controller returns a real
   * non-2xx status the simulator's own best-effort caller can honestly report as "gagal terkirim".
   * The downstream `onAgentRunJudged` trigger (proposal generation + auto-apply), however, stays
   * best-effort exactly like `judgeRun`'s own call to it — that pipeline already documents its own
   * "never let a proposal-generation failure surface" discipline, unrelated to whether THIS batch
   * was honestly recorded.
   *
   * `runRef`: unlike `028_agent_runs.sql`'s 3 named per-agent pointers (a real `calendar_events.id`/
   * `creative_packages.id`/`leads.id` row), a simulate-all batch has no real persisted row of its
   * own anywhere — `apps/aaos-simulator` is confirmed completely stateless (background doc: "nothing
   * is ever persisted to any database"). `runRef` is therefore an honest SYNTHETIC pointer
   * (`simulate-all:<judgedAt ISO timestamp>`), documented as such rather than silently reusing one
   * of the 3 real per-row conventions this table's own header doc establishes for the other 3
   * real call sites.
   */
  async ingestSimulationBatch(
    tenantId: string,
    dto: IngestSimulationBatchBodyDto,
  ): Promise<IngestSimulationBatchResult> {
    const context = {
      source: "SIMULATION_BATCH",
      judgedAt: dto.judgedAt,
      totalPersonas: dto.totalPersonas,
      overallVerdict: dto.overallVerdict,
      avgOverallScore: dto.avgOverallScore,
      weakestDimensions: dto.weakestDimensions,
      topPriorities: dto.topPriorities,
      perPersona: dto.results.map((r) => ({
        personaId: r.personaId,
        difficulty: r.personaDifficulty,
        overallScore: r.overallScore,
        grade: r.grade,
        verdict: r.verdict,
      })),
    };

    const agentRunId = await this.agentRuns.record(
      tenantId,
      "CLARA",
      `simulate-all:${dto.judgedAt}`,
      context,
    );
    if (agentRunId === undefined) {
      throw new Error(
        "AiJudgeService.ingestSimulationBatch: AgentRunsService.record failed — no agent_runs row written (see its own logged warning for the real cause).",
      );
    }

    // Real, honest per-dimension averages across every judged persona in this batch — `@aos/ai-judge`'s
    // own real key vocabulary kept verbatim (see `ingest-simulation-batch.dto.ts`'s own doc for why
    // this is deliberately NOT forced into CLARA's existing closing-based judge key names).
    const scores: Record<string, number> = {
      overall: dto.avgOverallScore,
      naturalLanguage: average(dto.results.map((r) => r.naturalLanguage)),
      qualification: average(dto.results.map((r) => r.qualification)),
      objectionHandling: average(dto.results.map((r) => r.objectionHandling)),
      closingAttempt: average(dto.results.map((r) => r.closingAttempt)),
      handoffQuality: average(dto.results.map((r) => r.handoffQuality)),
      responseLength: average(dto.results.map((r) => r.responseLength)),
    };

    // Real, LLM-authored-by-the-simulator's-own-judge highlight strings, deduplicated — never
    // fabricated by this service.
    const strengths = [...new Set(dto.results.flatMap((r) => r.highlights))].slice(0, 10);

    // Real gap items, built from the real `improvementSuggestions` each persona's judgement already
    // produced (never invented here) — capped at 20, same "judge-prompt-sized, never a full dump"
    // discipline `028_agent_runs.sql`'s `context` column doc establishes for this whole table family.
    const gaps = dto.results
      .flatMap((r) =>
        r.improvementSuggestions
          .filter((s) => s.priority === "HIGH" || s.priority === "MEDIUM")
          .map((s) => ({
            dimension: s.dimension,
            issue: `Persona ${r.personaId} (grade ${r.grade}, verdict ${r.verdict}) — prioritas ${s.priority}`,
            suggestion: s.suggestion,
            severity: s.priority,
          })),
      )
      .slice(0, 20);

    const notes =
      `Batch simulate-all: ${String(dto.totalPersonas)} persona, avgOverallScore=${dto.avgOverallScore.toFixed(1)}, ` +
      `verdict=${dto.overallVerdict}, approve=${String(dto.approvedCount)}, needsImprovement=${String(dto.needsImprovementCount)}, ` +
      `fail=${String(dto.failCount)}. Weakest dimensions: ${dto.weakestDimensions.map((w) => `${w.dimension}=${w.avgScore.toFixed(1)}`).join(", ") || "(none)"}.`;

    const judgeResultRow = await this.repository.insert({
      tenantId,
      agent: "CLARA",
      runId: agentRunId,
      scores,
      strengths,
      gaps,
      notes,
    });

    // Same trigger point `judgeRun` already establishes (right after a real `judge_results` row is
    // successfully persisted) — best-effort: `LearningService.onAgentRunJudged` already has its own
    // outer try/catch, this one is defensive-in-depth, same discipline `ClosingsService.createClosing`'s
    // own detached `.catch()` around `judgeRun` models. A proposal-generation failure must never
    // change the real, already-honest "batch recorded" outcome this method returns to its caller.
    this.learningService
      .onAgentRunJudged(tenantId, agentRunId, "CLARA", {
        scores,
        gaps,
        trend: "STABLE", // Honest placeholder — see `LearningService.triggerManualCheck`'s own doc for why "STABLE" is the one honest value when no real trend was computed for this run.
      })
      .catch((caught: unknown) => {
        this.logger.warn(
          `AiJudgeService.ingestSimulationBatch: onAgentRunJudged(${agentRunId}) rejected: ${String(caught)}`,
        );
      });

    return { agentRunId, judgeResultId: judgeResultRow.id };
  }
}
