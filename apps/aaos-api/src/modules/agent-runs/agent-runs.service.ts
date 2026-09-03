import { Injectable, Logger } from "@nestjs/common";

import { AgentRunRepository, type AgentRunRow } from "./infrastructure/agent-run.repository.js";

/** `SAMANTHA | KAI | CLARA`, per `CLAUDE.md`'s real agent roster — plain `string`, never a union type, matching `agent_runs.agent`'s free-`TEXT` column (`028_agent_runs.sql`'s own documented "never a CHECK enum" convention every prior `agent` column in this migration folder follows). */
export type AgentRunAgent = string;

/**
 * `modules/agent-runs` (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J1) — a small, standalone module, same
 * "small standalone module" precedent `modules/activity-log`/`modules/mode-guard` establish for
 * themselves: `AgentRunsService`'s real consumers (`SchedulerModule`, `CreativePackagesModule`,
 * `ClosingsModule`) need only import this one module to record a real run — no circular-import
 * risk.
 *
 * `record()` is deliberately best-effort, mirroring `ActivityLogger.start()`'s own documented
 * discipline ("logging a real agent action must never be the reason the real action itself
 * fails"): a real Samantha analyze run, a real Kai creative-package generation, or a real Clara
 * conversation reaching a terminal state must NEVER be aborted by a failure to record its
 * `agent_runs` pointer row. Every failure is caught and warned here — no caller needs its own
 * try/catch around this call.
 */
@Injectable()
export class AgentRunsService {
  private readonly logger = new Logger(AgentRunsService.name);

  constructor(private readonly repository: AgentRunRepository) {}

  /**
   * Records one real, judgeable run. `runRef` is the real, polymorphic pointer described in
   * `028_agent_runs.sql`'s header doc (a `calendar_events.id` for SAMANTHA, a
   * `creative_packages.id` for KAI, a `leads.id` for CLARA). `context` must be a small,
   * judge-prompt-sized summary — never a full duplicate of the source row; each real call site
   * documents why its own shape is honest and minimal.
   *
   * Returns the new row's real `id` (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2) so a best-effort
   * caller can hand it straight to `AiJudgeService.judgeRun` without a second lookup — or
   * `undefined` when the insert itself failed (the same real failure this method already swallows
   * and warns on; a caller checks for `undefined` rather than this method throwing).
   */
  async record(
    tenantId: string,
    agent: AgentRunAgent,
    runRef: string,
    context: Record<string, unknown>,
  ): Promise<string | undefined> {
    try {
      const row = await this.repository.insert({
        tenant_id: tenantId,
        agent,
        run_ref: runRef,
        context,
      });
      return row.id;
    } catch (caught) {
      this.logger.warn(`AgentRunsService.record(${agent}, ${runRef}) failed: ${String(caught)}`);
      return undefined;
    }
  }

  /**
   * A single `agent_runs` row by id, or `undefined` when none exists (AAOS-AI-JUDGE-SELF-IMPROVING,
   * Phase J2) — `AiJudgeService.judgeRun`'s real read of the run it's about to score. Deliberately
   * NOT best-effort/swallowing like `record()`: a read failure here has nothing left to protect (no
   * real agent action is in flight at this point), so it propagates — `AiJudgeService.judgeRun`'s
   * own outer try/catch is what keeps this from ever escaping to a real caller.
   */
  async findById(id: string): Promise<AgentRunRow | undefined> {
    return this.repository.findById(id);
  }

  /**
   * The single most recent `agent_runs` row for one real tenant+agent, or `undefined` when none
   * exists — AAOS Self-Improving, Phase SI-5's real fallback baseline for
   * `SandboxService.testImprovement` (see `AgentRunRepository.findLatestForTenantAgent`'s own doc).
   * Deliberately NOT best-effort like `record()` — same reasoning `findById`'s own doc gives: no
   * real agent action is in flight at this read, so a failure propagates to this method's own
   * caller (`SandboxService.testImprovement`, which already degrades honestly on any thrown error
   * via its own outer handling in `LearningService.persistProposal`).
   */
  async findLatestForTenantAgent(
    tenantId: string,
    agent: AgentRunAgent,
  ): Promise<AgentRunRow | undefined> {
    return this.repository.findLatestForTenantAgent(tenantId, agent);
  }
}
