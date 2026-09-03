import { Injectable, Logger } from "@nestjs/common";

import {
  JudgeResultRepository,
  type JudgeResultRow,
} from "../ai-judge/infrastructure/judge-result.repository.js";
import {
  LearningProposalRepository,
  type LearningProposalRow,
} from "../learning/infrastructure/learning-proposal.repository.js";
import { ImprovementItemSchema } from "../llm/dto/improvement-plan.dto.js";
import type { JudgeMemory } from "../llm/dto/judge-agent-run.dto.js";

/** How many of the tenant+agent's most recent REAL applied proposals to surface in `appliedProposals`. */
const MAX_APPLIED_PROPOSALS = 3;
/** How many of the tenant+agent's most recent `learning_proposals` rows to scan for applied ones / patterns. Wider than `MAX_APPLIED_PROPOSALS` since most recent rows may not all be applied. */
const PROPOSAL_SCAN_LIMIT = 10;
/** How many distinct known-pattern strings to surface — a short list, not a dump. */
const MAX_KNOWN_PATTERNS = 5;
/** Each `knownPatterns` entry is truncated to this length — a short memory hint for the judge prompt, never a full re-paste of an LLM analysis. */
const PATTERN_MAX_CHARS = 240;

/** Reads a real, previously-persisted `overall` score out of a `judge_results.scores` JSONB blob — `undefined` (never `0`) when the shape is unexpected. Same real extraction every other real consumer of `judge_results.scores` already establishes (`AiJudgeService`/`SandboxService`'s own module-local copies) — restated here rather than reached across a module boundary for one helper, same precedent those two classes already set for each other. */
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

/**
 * Whether a real `learning_proposals` row genuinely applied SOMETHING to production for its
 * tenant+agent — `status === 'AUTO_APPLIED'` (Phase SI-1/SI-2, and Phase SI-5 for a sandbox-cleared
 * `PROMPT_UPDATE`), `status === 'APPROVED'` (Phase C's human-gated `PROMPT_UPDATE` write), OR a
 * MIXED row (`auto_applied_config_keys` non-empty even though overall `status` stayed `'PENDING'`/
 * `'AUTO_APPLY_BLOCKED_BY_SANDBOX'` because another item on the same row is still genuinely pending/
 * blocked). Never counts a plain `'PENDING'`/`'REJECTED'`/fully-`'AUTO_APPLY_BLOCKED_BY_SANDBOX'`
 * (nothing applied) row.
 */
function wasGenuinelyApplied(row: LearningProposalRow): boolean {
  return (
    row.status === "AUTO_APPLIED" ||
    row.status === "APPROVED" ||
    (Array.isArray(row.auto_applied_config_keys) && row.auto_applied_config_keys.length > 0)
  );
}

/**
 * The real `PROMPT_UPDATE`/`CONFIG_UPDATE`/`LOGIC_UPDATE` targets this row genuinely applied.
 * `auto_applied_config_keys` already covers CONFIG_UPDATE/LOGIC_UPDATE (Phase SI-1/SI-2) and, as of
 * Phase SI-5, a sandbox-cleared auto-applied PROMPT_UPDATE (`LearningService.persistProposal`'s own
 * updated doc). For a row `status === 'APPROVED'` (the human-gated path,
 * `LearningDecisionService.approve`), `auto_applied_config_keys` is never populated by that path
 * (Phase C predates it) — so this function ALSO re-validates `row.improvements` against
 * `ImprovementItemSchema` and includes every real `PROMPT_UPDATE` target found there for an
 * `APPROVED` row specifically (approve() applies every PROMPT_UPDATE item on the row, per that
 * method's own doc — never a partial application for the human-approve path). This is a real,
 * best-effort reconstruction of "what got applied", not a guess: a malformed `improvements` item
 * simply contributes nothing, same "an LLM's output shape is never trusted blindly" discipline this
 * whole effort follows elsewhere.
 */
function appliedTargetsFor(row: LearningProposalRow): readonly string[] {
  const configOrLogicOrSandboxClearedPrompt = Array.isArray(row.auto_applied_config_keys)
    ? row.auto_applied_config_keys.filter((key): key is string => typeof key === "string")
    : [];
  if (row.status !== "APPROVED") {
    return configOrLogicOrSandboxClearedPrompt;
  }
  const approvedPromptTargets: string[] = [];
  for (const raw of row.improvements) {
    const parsed = ImprovementItemSchema.safeParse(raw);
    if (parsed.success && parsed.data.type === "PROMPT_UPDATE") {
      approvedPromptTargets.push(parsed.data.target);
    }
  }
  return [...new Set([...configOrLogicOrSandboxClearedPrompt, ...approvedPromptTargets])];
}

/**
 * `JudgeMemoryService` (AAOS Self-Improving, Phase SI-5) — real, curated "Judge Memory", replacing
 * the raw "last 10 `judge_results.scores.overall` values" memory `AiJudgeService.judgeRun`/
 * `SandboxService` each used to build INLINE (duplicated between the two). Deliberately a SMALL,
 * STANDALONE module composing its OWN `JudgeResultRepository`/`LearningProposalRepository`
 * instances over the shared `SUPABASE_CLIENT` — same "each module composes its own instance of a
 * shared repository class over one shared connection" pattern `SandboxModule` already establishes
 * for `JudgeResultRepository` specifically — rather than importing `AiJudgeModule`/`LearningModule`,
 * which would create a real circular-import risk (`AiJudgeModule` imports `LearningModule`;
 * `LearningModule`, as of this phase, imports `SandboxModule` for its own real sandbox-gated
 * PROMPT_UPDATE auto-apply — see that module's own doc — so `SandboxModule` importing anything that
 * imports `LearningModule` back would cycle).
 *
 * REAL, HONEST SCOPE (documented per this phase's own coordinator instruction — never fabricate a
 * score/trend/pattern this class cannot honestly compute from real data):
 *
 * 1. `recent`/`averageOverall` — UNCHANGED real shape (`JudgeResultRepository.listRecentForTenant`,
 *    last up to 10 rows, oldest-first, honest average).
 * 2. `appliedProposals` — real `learning_proposals` rows that genuinely applied something for this
 *    tenant+agent (`wasGenuinelyApplied`), each with a REAL judge-score trend computed ONLY by
 *    partitioning the SAME `recent` (≤10) rows above by the proposal's own `created_at` — never a
 *    separate query, never invented. `scoreBefore`/`scoreAfter` are `null` when that side of the
 *    partition has zero real rows in the 10-row window (an honest "not enough data", never "no
 *    change" or a fabricated `0`); `trend` is `"UNKNOWN"` unless BOTH sides are real numbers.
 *    HONEST LIMITATION: because this reuses the SAME capped 10-row window (never a second,
 *    unbounded query), a proposal older than the tenant+agent's last 10 judged runs will show
 *    `scoreBefore: null` even if real pre-proposal history exists further back — documented here,
 *    not hidden, rather than paying for a second unbounded query this phase's own scope does not
 *    call for.
 * 3. `knownPatterns` — real, deduplicated `learning_proposals.self_analysis.patterns` text from this
 *    tenant+agent's own recent REAL applied proposals (`self_analysis` is Phase SI-3's real,
 *    optional `LlmService.selfAnalyze` output — `null` on plenty of real rows, silently skipped
 *    here, never backfilled with an invented pattern).
 *
 * HONEST GAP, DOCUMENTED RATHER THAN FABRICATED (per this phase's own coordinator instruction): a
 * real `'ROLLED_BACK'` proposal status does not exist anywhere in this codebase today
 * (`PromptOverrideService.rollback` is a real, MANUAL, auditable action against
 * `agent_prompt_overrides` directly — it never writes back to `learning_proposals.status` at all,
 * verified directly against that method's own doc and `LearningDecisionService.rollback`'s thin
 * delegation to it). This class therefore has NO real rollback data to surface, and deliberately does
 * NOT invent a `rolledBack` field with a fabricated empty/zero value standing in for "we don't track
 * this yet" — it simply omits the concept entirely rather than manufacturing a fake honest-looking
 * degrade for something that was never real to begin with.
 *
 * DEGRADE, SPARSE DATA: when a tenant+agent has zero judged runs and/or zero applied proposals yet
 * (the honest, common case for a new tenant or a fresh Phase SI-5 rollout), `recent`/
 * `appliedProposals`/`knownPatterns` are all real, honest empty arrays and `averageOverall` is
 * `null` — never a fabricated trend or pattern manufactured to look populated.
 */
@Injectable()
export class JudgeMemoryService {
  private readonly logger = new Logger(JudgeMemoryService.name);

  constructor(
    private readonly judgeResults: JudgeResultRepository,
    private readonly learningProposals: LearningProposalRepository,
  ) {}

  async build(tenantId: string, agent: string): Promise<JudgeMemory> {
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
    const averageOverall = average(overallValues);

    let appliedProposals: JudgeMemory["appliedProposals"] = [];
    let knownPatterns: string[] = [];
    try {
      const proposalRows = await this.learningProposals.listRecentForTenantAgent(
        tenantId,
        agent,
        PROPOSAL_SCAN_LIMIT,
      );
      const applied = proposalRows.filter(wasGenuinelyApplied);

      appliedProposals = applied.slice(-MAX_APPLIED_PROPOSALS).map((row) => {
        const before = recentRows
          .filter((r) => r.created_at < row.created_at)
          .map((r) => extractOverall(r.scores))
          .filter((value): value is number => value !== undefined);
        const after = recentRows
          .filter((r) => r.created_at >= row.created_at)
          .map((r) => extractOverall(r.scores))
          .filter((value): value is number => value !== undefined);
        const scoreBefore = average(before);
        const scoreAfter = average(after);
        const trend: "IMPROVED" | "DECLINED" | "UNCHANGED" | "UNKNOWN" =
          scoreBefore === null || scoreAfter === null
            ? "UNKNOWN"
            : scoreAfter > scoreBefore
              ? "IMPROVED"
              : scoreAfter < scoreBefore
                ? "DECLINED"
                : "UNCHANGED";
        return {
          createdAt: row.created_at,
          appliedTargets: [...appliedTargetsFor(row)],
          scoreBefore,
          scoreAfter,
          trend,
        };
      });

      const patternSeen = new Set<string>();
      for (const row of applied) {
        const selfAnalysis = row.self_analysis;
        const patterns =
          selfAnalysis !== null && typeof selfAnalysis["patterns"] === "string"
            ? (selfAnalysis["patterns"] as string).trim()
            : "";
        if (patterns.length === 0 || patternSeen.has(patterns)) {
          continue;
        }
        patternSeen.add(patterns);
        knownPatterns.push(
          patterns.length > PATTERN_MAX_CHARS
            ? `${patterns.slice(0, PATTERN_MAX_CHARS)}…`
            : patterns,
        );
        if (knownPatterns.length >= MAX_KNOWN_PATTERNS) {
          break;
        }
      }
    } catch (caught) {
      // Best-effort, same discipline every other side-effect in this codebase follows: a failure to
      // enrich judge memory must NEVER be the reason a real judge call (or the sandbox test it may
      // be feeding) fails — degrade honestly to the base recent/averageOverall shape instead.
      this.logger.warn(
        `JudgeMemoryService.build(${tenantId}, ${agent}): applied-proposal enrichment failed — degrading to base memory (recent/averageOverall only): ${String(caught)}`,
      );
      appliedProposals = [];
      knownPatterns = [];
    }

    return { recent, averageOverall, appliedProposals, knownPatterns };
  }
}
