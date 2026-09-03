import { Injectable, Logger } from "@nestjs/common";

import { AgentConfigService } from "../agent-config/agent-config.service.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import {
  JudgeResultRepository,
  type JudgeResultRow,
} from "../ai-judge/infrastructure/judge-result.repository.js";
import type { AnalyzeRequestDto } from "../llm/dto/analyze.dto.js";
import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";
import type { JudgeMemory } from "../llm/dto/judge-agent-run.dto.js";
import { LlmService } from "../llm/llm.service.js";

/** `agent_configs` bucket/key for the real `min_delta_to_apply` sandbox gate (design doc's own spec: `SANDBOX` bucket, default 3). */
const SANDBOX_CONFIG_BUCKET = "SANDBOX";
const MIN_DELTA_CONFIG_KEY = "min_delta_to_apply";
const DEFAULT_MIN_DELTA = 3;

/**
 * Real, honest result of one `SandboxService.testImprovement` call. `available: false` means this
 * phase genuinely could NOT test the improvement (missing/insufficient historical data, or the LLM
 * being unavailable for the re-run or the judge call) — `reason` is always populated in that case,
 * and `improved`/every score field is a real, honest `false`/`null`, NEVER a fabricated number.
 */
export interface SandboxTestResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly improved: boolean;
  readonly baselineScore: number | null;
  readonly sandboxScore: number | null;
  readonly delta: number | null;
  readonly minDelta: number;
}

function degrade(reason: string, minDelta: number): SandboxTestResult {
  return {
    available: false,
    reason,
    improved: false,
    baselineScore: null,
    sandboxScore: null,
    delta: null,
    minDelta,
  };
}

/** Reads a real, previously-persisted `overall` score out of a `judge_results.scores` JSONB blob — `undefined` (never `0`) when the shape is unexpected. Same real extraction `AiJudgeService`'s own module-local `extractOverall` already establishes (not exported from that file, so restated here rather than reached across a module boundary for one helper). */
function extractOverall(scores: Record<string, unknown>): number | undefined {
  const overall = scores["overall"];
  return typeof overall === "number" ? overall : undefined;
}

/** A real, honestly-computed average — `null` (never `0`) when `values` is empty. Same shape `AiJudgeService`'s own module-local `average` already establishes. */
function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * `SandboxService` (AAOS Self-Improving, Phase SI-4) — a real, historical-data-only re-run of ONE
 * concrete, well-supported case: SAMANTHA's real `analyze` call, re-run with a candidate
 * `PROMPT_UPDATE` item's proposed content substituted in-memory for ONE `LlmService.analyze` call,
 * scored by the SAME real `LlmService.judgeAgentRun` machinery `AiJudgeService.judgeRun` already
 * uses, and compared against the real, already-persisted `judge_results` score for a real baseline
 * `agent_runs` row. Never writes to any real table — pure computation plus 2 real LLM calls (one
 * re-run `analyze`, one `judgeAgentRun`, the latter DELIBERATELY called directly rather than via
 * `AiJudgeService.judgeRun` so no fake `judge_results` row is ever persisted for a sandbox run).
 *
 * SCOPE, investigated and confirmed directly against real code before building (never assumed):
 * ONLY `agent === "SAMANTHA"`, `item.type === "PROMPT_UPDATE"`, `item.target === "analyze"` is
 * honestly supported. Everything else degrades with a real, explicit reason — never a fabricated
 * score. Two real, confirmed findings drive this scope:
 *
 * 1. `CONFIG_UPDATE`/`LOGIC_UPDATE` have NO real effect on SAMANTHA's `analyze` call — verified
 *    directly: `AgentConfigService.get`/`AgentLogicService.get` are consumed ONLY by
 *    `campaign-trigger.ts`'s `pause_cpl_multiplier` and `SchedulerService.runSamanthaAnalyze`'s own
 *    `verdict_classification` digest (both PURE, non-LLM functions), never by `LlmService.analyze`
 *    itself. A "sandbox test" of a CONFIG_UPDATE/LOGIC_UPDATE item against `analyze` would have
 *    nothing real to measure — this class refuses to fabricate one; see this whole effort's own
 *    Phase SI-4 doc for the same conclusion.
 * 2. Even for `PROMPT_UPDATE`, the REAL `SAMANTHA_JUDGE_SYSTEM_PROMPT` (`LlmService`'s own judge
 *    prompt constant) scores `context.campaigns`/`context.totalAds`/`context.pause`/`context.scale`
 *    — real, structural counts computed from the tenant's real ad-account data, INDEPENDENT of
 *    `analyze`'s own LLM response text (`temuan`/`rekomendasi`/`ringkasan`) — plus
 *    `context.aiAvailable`. The judge is NEVER shown `analyze`'s actual response text at all. So a
 *    sandbox re-run with a candidate prompt can only honestly move ONE real judge dimension —
 *    `ai_availability` (30% weight): whether the candidate prompt still yields a valid, parseable
 *    JSON response. This is a real, useful signal (it catches a candidate prompt that breaks the
 *    expected output format) but it does NOT — and cannot, with the judge machinery this phase is
 *    required to reuse — detect a genuine qualitative improvement/regression in analysis quality.
 *    Documented here, not hidden: every real caller of this service's result should read `delta` as
 *    "did this candidate prompt keep producing valid output, plus normal LLM judge noise", not as a
 *    content-quality verdict.
 *
 * `min_delta_to_apply` is a real `agent_configs` row (`SANDBOX` bucket, default 3, per the design
 * doc's own spec) — resolved via the SAME real `AgentConfigService.get` get-with-fallback shape
 * every other config threshold in this codebase already uses, never hardcoded inline.
 *
 * NOT wired into any auto-apply flow in this phase (a deliberate, documented scope decision — see
 * this phase's own commit message / final report): `LearningDecisionService.approve`'s existing
 * human-gated `PROMPT_UPDATE` behavior is UNCHANGED. Given finding #2 above, the real signal this
 * sandbox can produce for `analyze` is narrow (mostly "still valid JSON", not "actually better") —
 * wiring an automatic, ungated production write (replacing the codebase's own documented "HARD
 * RULE: an AI-generated improvement must NEVER apply to production without an explicit human
 * Approve action" for PROMPT_UPDATE) on top of that narrow a signal would be building a gate that
 * LOOKS real but tests far less than its name implies — exactly the kind of fabricated-workaround
 * this whole effort's discipline avoids elsewhere. Left for Phase SI-5, where the design doc's own
 * plan already revisits `LearningDecisionService.approve`'s human gate for all 3 types together.
 */
@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    private readonly agentRuns: AgentRunsService,
    private readonly llmService: LlmService,
    private readonly agentConfig: AgentConfigService,
    private readonly judgeResults: JudgeResultRepository,
  ) {}

  async testImprovement(
    tenantId: string,
    agent: string,
    item: ImprovementItem,
    baselineAgentRunId: string,
  ): Promise<SandboxTestResult> {
    const minDelta = await this.agentConfig.get(
      tenantId,
      SANDBOX_CONFIG_BUCKET,
      MIN_DELTA_CONFIG_KEY,
      DEFAULT_MIN_DELTA,
    );

    if (agent !== "SAMANTHA" || item.type !== "PROMPT_UPDATE" || item.target !== "analyze") {
      return degrade(
        `SandboxService.testImprovement is honestly scoped to SAMANTHA PROMPT_UPDATE(target="analyze") only in this phase (SI-4) — got agent="${agent}", type="${item.type}", target="${item.target}". See this class's own doc for why CONFIG_UPDATE/LOGIC_UPDATE have no real effect on "analyze" to sandbox-test.`,
        minDelta,
      );
    }

    const run = await this.agentRuns.findById(baselineAgentRunId);
    if (run === undefined) {
      return degrade(`agent_runs row "${baselineAgentRunId}" not found.`, minDelta);
    }
    if (run.agent !== "SAMANTHA") {
      return degrade(
        `agent_runs row "${baselineAgentRunId}" is agent "${run.agent}", not SAMANTHA.`,
        minDelta,
      );
    }

    const context = (run.context ?? {}) as Record<string, unknown>;
    const analyzeCampaigns = context["analyzeCampaigns"];
    if (!Array.isArray(analyzeCampaigns)) {
      return degrade(
        `agent_runs row "${baselineAgentRunId}" has no real "analyzeCampaigns" in its context — it predates the Phase SI-4 context-capture fix (SchedulerService.runSamanthaAnalyze) and cannot be honestly re-run against the SAME historical data. This is a real, expected degrade for every agent_runs row recorded before that fix shipped, not a bug.`,
        minDelta,
      );
    }

    // Real baseline score — the ALREADY-PERSISTED `judge_results` row for this exact real run,
    // never re-judged (see this class's own doc for why).
    const baselineRow = await this.judgeResults.findByRunId(baselineAgentRunId);
    if (baselineRow === undefined) {
      return degrade(
        `agent_runs row "${baselineAgentRunId}" has no real judge_results row — it was never successfully judged (or judging was unavailable when it ran), so there is no real baseline score to compare against.`,
        minDelta,
      );
    }
    const baselineScore = extractOverall(baselineRow.scores);
    if (baselineScore === undefined) {
      return degrade(
        `judge_results row for "${baselineAgentRunId}" has no real numeric "overall" score.`,
        minDelta,
      );
    }

    const analyzeBody: AnalyzeRequestDto = {
      campaigns: analyzeCampaigns as AnalyzeRequestDto["campaigns"],
      totals: (context["analyzeTotals"] ?? undefined) as AnalyzeRequestDto["totals"],
    };

    // Real, in-memory-only re-run: the SAME historical `campaigns`/`totals` this baseline run
    // actually used, with the candidate prompt substituted via `LlmService.analyze`'s new 3rd
    // parameter (see that method's own doc) — never writes to `agent_prompt_overrides`.
    const sandboxAnalysis = await this.llmService.analyze(tenantId, analyzeBody, item.after);

    // Real, honest re-composition of the SAME judge-visible context shape the real SAMANTHA judge
    // prompt scores against (`SAMANTHA_JUDGE_SYSTEM_PROMPT`'s own doc): "campaigns"/"totalAds"/
    // "pause"/"scale" are carried over UNCHANGED from the real baseline run — they are computed
    // from the tenant's real historical ad-account data, never from `analyze`'s own LLM response
    // (`SchedulerService.runSamanthaAnalyze`'s own doc) — only "aiAvailable" can honestly differ
    // between baseline and sandbox, reflecting whether the CANDIDATE prompt still produces a valid,
    // parseable `analyze` response. See this class's own doc for the real, load-bearing limitation
    // this implies.
    const sandboxContext: Record<string, unknown> = {
      ...context,
      aiAvailable: sandboxAnalysis.available,
    };

    const memory = await this.buildMemory(tenantId, "SAMANTHA");

    // Deliberately `LlmService.judgeAgentRun` directly, NOT `AiJudgeService.judgeRun` — that method
    // persists a real `judge_results` row keyed to a real `agent_runs.id`, which this sandbox run
    // must never create (see this class's own doc). `runRef` is a real, distinguishable sandbox
    // marker (never a real `calendar_events.id`) so this call's `ResponseCache` key can never
    // collide with a real invocation's cache entry for the SAME underlying context.
    const judged = await this.llmService.judgeAgentRun(tenantId, {
      tenantId,
      agent: "SAMANTHA",
      runRef: `SANDBOX:${item.target}:${baselineAgentRunId}`,
      runCreatedAt: run.created_at,
      context: sandboxContext,
      memory,
    });

    if (!judged.available) {
      return degrade(`sandbox judgeAgentRun unavailable (${judged.reason}).`, minDelta);
    }
    const sandboxScore = judged.agent === "SAMANTHA" ? judged.scores.overall : undefined;
    if (sandboxScore === undefined) {
      return degrade("sandbox judgeAgentRun returned no real numeric overall score.", minDelta);
    }

    const delta = sandboxScore - baselineScore;
    const improved = delta >= minDelta;

    this.logger.log(
      `SandboxService.testImprovement(${tenantId}, ${baselineAgentRunId}): baseline=${String(baselineScore)} sandbox=${String(sandboxScore)} delta=${String(delta)} minDelta=${String(minDelta)} improved=${String(improved)}`,
    );

    return { available: true, improved, baselineScore, sandboxScore, delta, minDelta };
  }

  /** Same real "last 10 raw overall scores + honest average" memory shape `AiJudgeService.judgeRun` already builds — restated here (not exported from that file) since this class deliberately does not depend on `AiJudgeService` itself (see this class's own doc for why it calls `LlmService.judgeAgentRun` directly). */
  private async buildMemory(tenantId: string, agent: string): Promise<JudgeMemory> {
    const recentRows: readonly JudgeResultRow[] = await this.judgeResults.listRecentForTenant(
      tenantId,
      agent,
      10,
    );
    const recent = recentRows.map((row) => ({
      createdAt: row.created_at,
      overall: extractOverall(row.scores) ?? 0,
    }));
    const overallValues = recentRows
      .map((row) => extractOverall(row.scores))
      .filter((value): value is number => value !== undefined);
    return { recent, averageOverall: average(overallValues) };
  }
}
