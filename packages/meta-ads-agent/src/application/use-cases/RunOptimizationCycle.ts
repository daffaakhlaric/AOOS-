import { err, ok, ErrorCode, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { Ad, AdAccount } from "@aos/meta-ads-connector";
import type { Objective, ObjectiveProgress } from "@aos/objective-engine";
import type { getTracer } from "@aos/telemetry";

import { DailyDigestBuilder } from "../../builders/DailyDigestBuilder.js";
import { ExecutionPlanBuilder } from "../../builders/ExecutionPlanBuilder.js";
import type { MetaAdsAgentConfig } from "../../config/MetaAdsAgentConfig.js";
import type { ICampaignOptimizer } from "../../contracts/ICampaignOptimizer.js";
import type { CreativeBrief } from "../../domain/entities/CreativeBrief.js";
import type { DailyDigest } from "../../domain/entities/DailyDigest.js";
import { EscalationRequest } from "../../domain/entities/EscalationRequest.js";
import type { ExecutionPlan } from "../../domain/entities/ExecutionPlan.js";
import { AgentError } from "../../domain/errors/index.js";
import type { MetaAdsAgentEvents } from "../../domain/events/MetaAdsAgentEvents.js";
import { AgentState } from "../../domain/value-objects/AgentState.js";
import { DecisionType } from "../../domain/value-objects/DecisionType.js";
import type { DecisionRegistry } from "../../registry/DecisionRegistry.js";
import type { DecisionEngineService } from "../services/DecisionEngineService.js";
import type { EscalationService } from "../services/EscalationService.js";
import type { ExecutionService } from "../services/ExecutionService.js";
import type { SamanthaAgentService } from "../services/SamanthaAgentService.js";

import type { GenerateCreativeBrief } from "./GenerateCreativeBrief.js";

/** Local alias avoiding a direct `@opentelemetry/api` dependency, mirroring `@aos/objective-engine`'s `CreateObjective.ts`. */
export type Tracer = ReturnType<typeof getTracer>;

export interface RunOptimizationCycleInput {
  readonly adAccount: AdAccount;
  readonly objective: Objective;
  readonly progress: ObjectiveProgress;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface RunOptimizationCycleOutput {
  readonly plan: ExecutionPlan;
  readonly creativeBriefs: ReadonlyArray<CreativeBrief>;
  readonly escalations: ReadonlyArray<EscalationRequest>;
  readonly digest: DailyDigest;
}

/**
 * Samantha's main entry point — the full PERCEIVE → ANALYZE → DECIDE → ACT → REPORT → LEARN loop
 * (spec: "Core Agent Loop"), composed from every intelligence/application collaborator wired by
 * `SamanthaAgentFactory`.
 */
export class RunOptimizationCycle {
  constructor(
    private readonly pipeline: ICampaignOptimizer,
    private readonly decisionEngine: DecisionEngineService,
    private readonly executionService: ExecutionService,
    private readonly escalationService: EscalationService,
    private readonly generateCreativeBrief: GenerateCreativeBrief,
    private readonly agentService: SamanthaAgentService,
    private readonly decisionRegistry: DecisionRegistry,
    private readonly events: MetaAdsAgentEvents,
    private readonly config: MetaAdsAgentConfig,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    input: RunOptimizationCycleInput,
  ): Promise<Result<RunOptimizationCycleOutput, AgentError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-agent.run-optimization-cycle",
      async (span: { end: () => void }) => {
        try {
          return await this.run(input);
        } finally {
          span.end();
        }
      },
    );
  }

  private async run(
    input: RunOptimizationCycleInput,
  ): Promise<Result<RunOptimizationCycleOutput, AgentError>> {
    const agent = this.agentService.getAgent();

    await this.events.publishAgentCycleStarted({
      tenantId: input.tenantId,
      agentId: agent.id,
      adAccountId: input.adAccount.id.toString(),
      objectiveId: input.objective.id.toString(),
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    this.agentService.transitionTo(AgentState.ANALYZING);

    const pipelineResult = this.pipeline.analyze(input.adAccount);
    if (!pipelineResult.ok) {
      return err(new AgentError(pipelineResult.error.code, pipelineResult.error.message));
    }

    const decisionsResult = this.decisionEngine.decideAll(
      pipelineResult.value,
      this.config,
      this.agentService.getMemory(),
    );
    if (!decisionsResult.ok) {
      return err(new AgentError(decisionsResult.error.code, decisionsResult.error.message));
    }
    const decisions = decisionsResult.value;

    for (const decision of decisions) {
      await this.events.publishDecisionMade({
        tenantId: input.tenantId,
        decisionId: decision.id.toString(),
        targetId: decision.targetId,
        targetType: decision.targetType,
        actionKind: decision.actionKind,
        decisionType: decision.decisionType,
        confidence: decision.confidence.toNumber(),
        correlationId: input.correlationId,
        occurredAt: this.now(),
        version: "1.0",
      });
    }

    const planResult = ExecutionPlanBuilder.build(input.tenantId, decisions, this.now());
    if (!planResult.ok) {
      return err(new AgentError(planResult.error.code, planResult.error.message));
    }
    const plan = planResult.value;

    this.agentService.transitionTo(AgentState.EXECUTING);

    const creativeBriefs: CreativeBrief[] = [];
    const escalations: EscalationRequest[] = [];
    const flatAds = RunOptimizationCycle.flattenAds(input.adAccount);
    const adsById = new Map<string, Ad>(flatAds.map((ad) => [ad.id.toString(), ad]));

    for (const decision of decisions) {
      if (decision.decisionType === DecisionType.AUTO_EXECUTE) {
        const execResult = await this.executionService.execute(
          decision,
          input.tenantId,
          input.correlationId,
        );
        if (execResult.ok) {
          this.agentService.getMemory().recordDecisionOutcome({
            decisionId: decision.id.toString(),
            actionKind: decision.actionKind,
            rphChatBeforeIDR: null,
            rphChatAfterIDR: null,
            recordedAt: this.now(),
          });
        } else {
          this.logger.warn(
            { decisionId: decision.id.toString(), error: execResult.error.message },
            "meta-ads-agent: auto-execute failed",
          );
        }
        continue;
      }

      if (decision.decisionType === DecisionType.ESCALATE) {
        const requestResult = EscalationRequest.create({
          id: decision.id,
          decision,
          status: "PENDING",
          createdAt: this.now(),
        });
        /* v8 ignore next 5 */
        if (!requestResult.ok) {
          // Unreachable: `status: "PENDING"` is always the literal above — EscalationRequest.create
          // only fails for an invalid status.
          return err(new AgentError(ErrorCode.VALIDATION_ERROR, requestResult.error.message));
        }
        this.escalationService.enqueue(requestResult.value);
        escalations.push(requestResult.value);
        await this.events.publishDecisionEscalated({
          tenantId: input.tenantId,
          decisionId: decision.id.toString(),
          escalationId: requestResult.value.id.toString(),
          targetId: decision.targetId,
          reason: decision.reason.toString(),
          correlationId: input.correlationId,
          occurredAt: this.now(),
          version: "1.0",
        });
        continue;
      }

      if (decision.decisionType === DecisionType.BRIEF_KAI) {
        const ad = adsById.get(decision.targetId);
        if (!ad) {
          continue;
        }
        const briefResult = await this.generateCreativeBrief.execute({
          ad,
          adAccount: input.adAccount,
          tenantId: input.tenantId,
          correlationId: input.correlationId,
          memory: this.agentService.getMemory(),
        });
        if (briefResult.ok) {
          creativeBriefs.push(briefResult.value);
          this.agentService.getMemory().recordAnglePerformance({
            unitBranchKey: `${ad.branch}:${ad.name}`,
            angle: briefResult.value.angle,
            sampleCount: 1,
            avgRphD3IDR: ad.metrics.rphD3.value ?? 0,
          });
        }
      }
    }

    this.decisionRegistry.savePlan(plan);
    this.agentService.completeCycle(this.now());

    await this.events.publishAgentCycleCompleted({
      tenantId: input.tenantId,
      agentId: agent.id,
      executionPlanId: plan.id.toString(),
      totalDecisions: decisions.length,
      autoExecutedCount: plan.autoExecuted().length,
      escalatedCount: plan.escalated().length,
      briefedToKaiCount: plan.briefedToKai().length,
      noActionCount: plan.noAction().length,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    const digestResult = DailyDigestBuilder.build({
      tenantId: input.tenantId,
      date: this.now(),
      targetHotLeads: input.objective.targetHotLeads.toNumber(),
      budgetAllocationIDR: input.objective.budgetAllocation.toNumber(),
      progress: input.progress,
      plan,
      creativeBriefs,
      escalations,
      adFindings: pipelineResult.value.adFindings,
      memory: this.agentService.getMemory(),
    });
    /* v8 ignore next 6 */
    if (!digestResult.ok) {
      // Unreachable: `input.tenantId` non-empty is already guaranteed by the successful
      // `ExecutionPlanBuilder.build` call above, and `DailyDigestBuilder`'s generated `text` is
      // always non-empty — the only two conditions `DailyDigest.create` can fail on.
      return err(new AgentError(digestResult.error.code, digestResult.error.message));
    }

    await this.events.publishDigestGenerated({
      tenantId: input.tenantId,
      date: digestResult.value.date,
      currentHotLeads: digestResult.value.currentHotLeads,
      targetHotLeads: digestResult.value.targetHotLeads,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    return ok({ plan, creativeBriefs, escalations, digest: digestResult.value });
  }

  private static flattenAds(adAccount: AdAccount): Ad[] {
    const ads: Ad[] = [];
    for (const campaign of adAccount.campaigns) {
      for (const adSet of campaign.adSets) {
        for (const ad of adSet.ads) {
          ads.push(ad);
        }
      }
    }
    return ads;
  }
}
