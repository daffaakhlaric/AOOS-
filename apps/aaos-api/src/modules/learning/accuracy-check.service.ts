import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { AgentConfigService } from "../agent-config/agent-config.service.js";
import {
  JudgeResultRepository,
  type JudgeResultRow,
} from "../ai-judge/infrastructure/judge-result.repository.js";

import {
  LearningProposalRepository,
  type LearningProposalRow,
} from "./infrastructure/learning-proposal.repository.js";

/** `agent_configs` bucket/key for the real "meaningful difference" band — reuses the same real, get-with-fallback shape `SandboxService`'s own `SANDBOX_CONFIG_BUCKET`/`MIN_DELTA_CONFIG_KEY` establish, a separate bucket since this is a genuinely different real gate (real-world accuracy over time, not a sandbox re-run). */
const ACCURACY_CONFIG_BUCKET = "ACCURACY";
const MIN_DELTA_CONFIG_KEY = "min_delta_to_flag";
/** Default "meaningful difference" band, in real judge `overall` points (0-100 scale) — same default magnitude `SandboxService.DEFAULT_MIN_DELTA` uses for its own analogous real gate, chosen for the same real reason: small enough to catch a genuine trend, large enough not to flag ordinary LLM-judge noise. */
const DEFAULT_MIN_DELTA = 3;

/** Real, honest minimum sample size PER SIDE (before/after) before a verdict is anything but `INCONCLUSIVE` — a hardcoded, documented constant (not an `agent_configs` row: this is a statistical-honesty floor, not a per-tenant tunable knob). 3 is chosen deliberately small (this codebase's judged-run volume is real but modest) while still being more than "one noisy data point" on either side. */
const MIN_SAMPLE_SIZE = 3;

/** How many of the tenant+agent's most recent real `judge_results` rows BEFORE a proposal's `created_at` to consider — mirrors `JudgeMemoryService`'s own "recent, capped window" precedent rather than an unbounded historical query. */
const BEFORE_SAMPLE_CAP = 30;

/** Defensive cap on how many real `judge_results` rows AFTER a proposal's `created_at` this service will average over in one check — `JudgeResultRepository.listForTenantSince` (the real query this reuses for the "after" side) has no upper bound of its own, so this service truncates in-app rather than ever holding an unbounded real result set in memory. A tenant+agent would need to accumulate more than this many real judged runs since ONE proposal was applied before this cap matters at all. */
const AFTER_SAMPLE_CAP = 500;

/** How many real, needing-a-check proposals one real cron tick processes — a bounded batch, same "never let one scheduled job's real workload grow unbounded" discipline every other real cron/batch job in this codebase follows. */
const BATCH_LIMIT = 200;

/** Reads a real, previously-persisted `overall` score out of a `judge_results.scores` JSONB blob — `undefined` (never `0`) when the shape is unexpected. Same real extraction `AiJudgeService`/`SandboxService`/`JudgeMemoryService` each restate as their own module-local copy (not exported across module boundaries for one helper — same precedent those files already set for each other). */
function extractOverall(scores: Record<string, unknown>): number | undefined {
  const overall = scores["overall"];
  return typeof overall === "number" ? overall : undefined;
}

/** A real, honestly-computed average — `null` (never `0`) when `values` is empty. */
function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function overallsOf(rows: readonly JudgeResultRow[]): number[] {
  return rows
    .map((row) => extractOverall(row.scores))
    .filter((value): value is number => value !== undefined);
}

export interface AccuracyCheckResult {
  readonly verdict: "IMPROVED" | "REGRESSED" | "INCONCLUSIVE";
  readonly reason: string;
  readonly scoreBefore: number | null;
  readonly scoreAfter: number | null;
  readonly sampleBefore: number;
  readonly sampleAfter: number;
}

/**
 * `AccuracyCheckService` (AAOS Self-Improving, Phase SI-6 — the FINAL phase). A real, weekly,
 * scheduled (`@Cron('0 9 * * MON')`, mirroring `docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s own Phase
 * SI-6 spec and `SchedulerService`'s own real `@Cron` precedent elsewhere in this app) check of
 * whether a past AUTO_APPLIED / AUTO_APPLY_BLOCKED_BY_SANDBOX `learning_proposals` row's real-world
 * effect can be honestly measured yet, and if so, whether it genuinely helped.
 *
 * REAL, GROUNDED SIGNAL (never fabricated): the SAME real `judge_results.scores.overall` this whole
 * effort already uses everywhere else (`JudgeMemoryService`/`SandboxService`/`AiJudgeService` all
 * read this exact field) — no new scoring mechanism invented for this phase. For each real,
 * needing-a-check proposal (`LearningProposalRepository.listNeedingAccuracyCheck`), this compares
 * the tenant+agent's real average `overall` score over up to `BEFORE_SAMPLE_CAP` real judged runs
 * immediately BEFORE the proposal's own `created_at` against up to `AFTER_SAMPLE_CAP` real judged
 * runs AFTER (inclusive) it — the exact same "partition by `created_at` relative to the proposal"
 * idea `JudgeMemoryService.build`'s own `appliedProposals` field already establishes, but over a
 * WIDER, TIME-BOUNDED (not merely "last 10 raw rows") real window, since this phase's job is
 * specifically to answer "did this proposal's effect hold up over real, accumulated post-apply
 * data" rather than `JudgeMemoryService`'s own narrower "quick LLM-prompt context" concern.
 *
 * HONEST DEGRADE (never invents a verdict): when either side of the partition has fewer than
 * `MIN_SAMPLE_SIZE` real rows, the verdict is `'INCONCLUSIVE'` with a real, explicit
 * `accuracy_reason` naming the real sample sizes — this is the REQUIRED, explicit "insufficient
 * data" degrade path this phase's own spec calls for, and it is exercised for real by
 * `accuracy-check.service.spec.ts`. A proposal whose verdict is (or becomes) `'INCONCLUSIVE'` stays
 * in `listNeedingAccuracyCheck`'s scan set and is re-checked on every subsequent real weekly run as
 * more real post-apply judge_results accumulate — it can genuinely resolve to `IMPROVED`/`REGRESSED`
 * later without any code change.
 *
 * `min_delta_to_flag` (`agent_configs`, `"ACCURACY"` bucket) is the real, tenant-overridable
 * "meaningful difference" band — a real delta smaller than this (even with sufficient sample sizes
 * on both sides) is ALSO honestly reported as `'INCONCLUSIVE'` (a real, computed "no meaningful
 * change detected" finding, distinguished from the insufficient-data case only by its
 * `accuracy_reason` text — both are real, non-fabricated outcomes of this same honest comparison).
 *
 * REAL, DOCUMENTED SCOPE BOUNDARY — NO AUTOMATIC ROLLBACK: a `'REGRESSED'` verdict is a real,
 * PASSIVE flag only. This service investigated whether a real, safe automatic revert belongs in this
 * phase and found: (1) `PromptOverrideService.rollback` (the only real, existing rollback mechanism
 * in this codebase, `LearningDecisionService.rollback`'s own thin delegation) reverts ONE
 * `agent_prompt_overrides` prompt-key to its immediately-prior version — it has no real
 * `agent_configs`/`agent_logic` equivalent, so a `CONFIG_UPDATE`/`LOGIC_UPDATE`-only proposal has no
 * real, existing "undo" this service could call at all; (2) even for a PROMPT_UPDATE proposal, a
 * `learning_proposals` row can carry MULTIPLE improvement items across potentially multiple
 * agents/targets, and this table has no real per-item "which specific override version resulted from
 * THIS item" linkage to safely target an automatic revert at (the same real "no cross-improvement
 * atomicity" limitation `LearningDecisionService.approve`'s own doc already documents for THIS exact
 * table); (3) automatically reverting a live prompt override based on a statistical judge-score dip
 * — without a human confirming the dip is real and attributable, not e.g. a seasonal/traffic-mix
 * shift — is a real, consequential production action this phase was never asked to build blind. A
 * `'REGRESSED'` verdict is therefore SURFACED HONESTLY (Learning Monitor UI, Phase SI-6's own other
 * half) with the real before/after scores and sample sizes as evidence, and the EXISTING real, manual
 * `POST /api/v1/learning/prompt-overrides/:tenantId/:agent/:promptKey/rollback` action
 * (`LearningDecisionService.rollback`, already wired to the dashboard's "Rollback" button) remains
 * the one real way to act on it — a deliberate, honest scope boundary, not an oversight.
 */
@Injectable()
export class AccuracyCheckService {
  private readonly logger = new Logger(AccuracyCheckService.name);

  constructor(
    private readonly proposals: LearningProposalRepository,
    private readonly judgeResults: JudgeResultRepository,
    private readonly agentConfig: AgentConfigService,
    // Same real bug/fix `AgentConfigService`/`PromptOverrideService`/`GoLiveService` document on
    // their own constructors: a bare `Function`-typed param with a default still gets a real DI
    // resolution attempt from Nest without `@Optional()`.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * The real, scheduled entry point. Best-effort PER ROW (same discipline every other real
   * side-effect in this codebase follows): one row's failure (a repository error, an unexpected
   * shape) is logged and skipped, never aborting the rest of the real batch.
   */
  @Cron("0 9 * * MON")
  async runWeeklyAccuracyCheck(): Promise<void> {
    let rows: readonly LearningProposalRow[];
    try {
      rows = await this.proposals.listNeedingAccuracyCheck(BATCH_LIMIT);
    } catch (caught) {
      this.logger.warn(
        `AccuracyCheckService.runWeeklyAccuracyCheck: listNeedingAccuracyCheck failed — skipping this real run entirely: ${String(caught)}`,
      );
      return;
    }
    this.logger.log(
      `AccuracyCheckService.runWeeklyAccuracyCheck: checking ${String(rows.length)} real proposal(s).`,
    );
    for (const row of rows) {
      try {
        await this.checkOne(row);
      } catch (caught) {
        this.logger.warn(
          `AccuracyCheckService.runWeeklyAccuracyCheck: checkOne(${row.id}) failed — best-effort, continuing with the rest of the real batch: ${String(caught)}`,
        );
      }
    }
  }

  /**
   * Real, single-proposal accuracy computation — split out from `runWeeklyAccuracyCheck` so it can
   * be called directly, both by that cron loop and by tests, without waiting on a real `@Cron` tick
   * (same "extract the real unit of work as its own testable method" discipline this whole effort's
   * other services already follow).
   */
  async checkOne(row: LearningProposalRow): Promise<AccuracyCheckResult> {
    const [beforeRows, afterRowsRaw] = await Promise.all([
      this.judgeResults.listBeforeTimestamp(
        row.tenant_id,
        row.agent,
        row.created_at,
        BEFORE_SAMPLE_CAP,
      ),
      this.judgeResults.listForTenantSince(row.tenant_id, row.agent, row.created_at),
    ]);
    const afterRows = afterRowsRaw.slice(0, AFTER_SAMPLE_CAP);

    const beforeOveralls = overallsOf(beforeRows);
    const afterOveralls = overallsOf(afterRows);
    const scoreBefore = average(beforeOveralls);
    const scoreAfter = average(afterOveralls);
    const sampleBefore = beforeOveralls.length;
    const sampleAfter = afterOveralls.length;

    let final: AccuracyCheckResult;
    if (sampleBefore < MIN_SAMPLE_SIZE || sampleAfter < MIN_SAMPLE_SIZE) {
      final = this.insufficientDataVerdict(scoreBefore, scoreAfter, sampleBefore, sampleAfter);
    } else {
      const minDelta = await this.agentConfig.get(
        row.tenant_id,
        ACCURACY_CONFIG_BUCKET,
        MIN_DELTA_CONFIG_KEY,
        DEFAULT_MIN_DELTA,
      );
      final = this.classifyByDelta(scoreBefore, scoreAfter, sampleBefore, sampleAfter, minDelta);
    }

    await this.proposals.recordAccuracyCheck(row.id, {
      verdict: final.verdict,
      reason: final.reason,
      scoreBefore: final.scoreBefore,
      scoreAfter: final.scoreAfter,
      sampleBefore: final.sampleBefore,
      sampleAfter: final.sampleAfter,
      checkedAt: this.now().toISOString(),
    });

    this.logger.log(`AccuracyCheckService.checkOne(${row.id}): ${final.verdict} — ${final.reason}`);
    return final;
  }

  /** Real, honest "insufficient data" degrade — used whenever either side of the partition has fewer than `MIN_SAMPLE_SIZE` real rows. */
  private insufficientDataVerdict(
    scoreBefore: number | null,
    scoreAfter: number | null,
    sampleBefore: number,
    sampleAfter: number,
  ): AccuracyCheckResult {
    return {
      verdict: "INCONCLUSIVE",
      reason: `Insufficient real data: ${String(sampleBefore)} judge_results row(s) before, ${String(sampleAfter)} after (need >= ${String(MIN_SAMPLE_SIZE)} on each side to compute an honest verdict).`,
      scoreBefore,
      scoreAfter,
      sampleBefore,
      sampleAfter,
    };
  }

  /** Real delta classification — only reached once both sides have `>= MIN_SAMPLE_SIZE` real rows. */
  private classifyByDelta(
    scoreBefore: number | null,
    scoreAfter: number | null,
    sampleBefore: number,
    sampleAfter: number,
    minDelta: number,
  ): AccuracyCheckResult {
    // `scoreBefore`/`scoreAfter` are real numbers whenever their sample size is >= MIN_SAMPLE_SIZE
    // (> 0) — `average()` only returns `null` for an empty array. Guarded here anyway (never a
    // fabricated `0`) rather than a non-null assertion, matching this codebase's own discipline.
    if (scoreBefore === null || scoreAfter === null) {
      return this.insufficientDataVerdict(scoreBefore, scoreAfter, sampleBefore, sampleAfter);
    }
    const delta = scoreAfter - scoreBefore;
    if (delta >= minDelta) {
      return {
        verdict: "IMPROVED",
        reason: `Real average judge score rose from ${scoreBefore.toFixed(1)} to ${scoreAfter.toFixed(1)} (delta +${delta.toFixed(1)}, >= the ${String(minDelta)}-point meaningful-difference band) over ${String(sampleBefore)} before / ${String(sampleAfter)} after real judge_results rows.`,
        scoreBefore,
        scoreAfter,
        sampleBefore,
        sampleAfter,
      };
    }
    if (delta <= -minDelta) {
      return {
        verdict: "REGRESSED",
        reason: `Real average judge score fell from ${scoreBefore.toFixed(1)} to ${scoreAfter.toFixed(1)} (delta ${delta.toFixed(1)}, beyond the -${String(minDelta)}-point meaningful-difference band) over ${String(sampleBefore)} before / ${String(sampleAfter)} after real judge_results rows — flagged, not auto-reverted (see this class's own doc for why).`,
        scoreBefore,
        scoreAfter,
        sampleBefore,
        sampleAfter,
      };
    }
    return {
      verdict: "INCONCLUSIVE",
      reason: `Real average judge score moved from ${scoreBefore.toFixed(1)} to ${scoreAfter.toFixed(1)} (delta ${delta.toFixed(1)}) — within the +/-${String(minDelta)}-point "not a meaningful difference" band, over ${String(sampleBefore)} before / ${String(sampleAfter)} after real judge_results rows.`,
      scoreBefore,
      scoreAfter,
      sampleBefore,
      sampleAfter,
    };
  }
}
