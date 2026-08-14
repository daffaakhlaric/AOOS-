import type { AssignLead, SalesTeamRegistry } from "@aos/branch-manager";
import type { IInventoryQueryService } from "@aos/dss-inventory-connector";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { FollowUpService } from "../application/services/FollowUpService.js";
import { HandoffService } from "../application/services/HandoffService.js";
import { JessyAgentService } from "../application/services/JessyAgentService.js";
import { LeadScoringService } from "../application/services/LeadScoringService.js";
import type { Tracer } from "../application/tracer.js";
import { CloseConversation } from "../application/use-cases/CloseConversation.js";
import { GetConversationState } from "../application/use-cases/GetConversationState.js";
import { ProcessIncomingMessage } from "../application/use-cases/ProcessIncomingMessage.js";
import { ScheduleFollowUp } from "../application/use-cases/ScheduleFollowUp.js";
import { SendFollowUp } from "../application/use-cases/SendFollowUp.js";
import { TriggerHandoff } from "../application/use-cases/TriggerHandoff.js";
import type { SalesAgentConfig } from "../config/SalesAgentConfig.js";
import type { IResponseGenerator } from "../contracts/IResponseGenerator.js";
import { ConversationEngine } from "../conversation/ConversationEngine.js";
import { ConversationPipeline } from "../conversation/ConversationPipeline.js";
import { ResponseGenerator } from "../conversation/ResponseGenerator.js";
import { JessyAgent as JessyAgentEntity } from "../domain/entities/JessyAgent.js";
import { JessyAgentEvents } from "../domain/events/JessyAgentEvents.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";
import { InventoryQuerier } from "../intelligence/InventoryQuerier.js";
import { JessyKnowledgeBase } from "../intelligence/JessyKnowledgeBase.js";
import { LlmResponseGenerator } from "../llm/LlmResponseGenerator.js";
import { OpenAiChatClient } from "../llm/OpenAiChatClient.js";
import { LeadScorer } from "../scoring/LeadScorer.js";

export interface JessyAgentFactoryOptions {
  readonly config: SalesAgentConfig;
  readonly branchId: BranchId;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline every prior AAOS package's factory establishes. */
  readonly publisher: IPublisher;
  /** Real `@aos/branch-manager` `AssignLead` use case — called for real by `HandoffService`, never mocked. */
  readonly assignLead: AssignLead;
  /** Real `@aos/branch-manager` `SalesTeamRegistry` — used to resolve the assigned sales human's display name. */
  readonly salesTeamRegistry: SalesTeamRegistry;
  /** Real `@aos/dss-inventory-connector` `IInventoryQueryService` — queried for real by `InventoryQuerier`, never mocked. */
  readonly inventoryQueryService: IInventoryQueryService;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock — defaults to the real wall clock only here. */
  readonly now?: () => Date;
}

export interface JessyAgent {
  readonly agent: JessyAgentEntity;
  readonly processIncomingMessage: ProcessIncomingMessage;
  readonly triggerHandoff: TriggerHandoff;
  readonly scheduleFollowUp: ScheduleFollowUp;
  readonly sendFollowUp: SendFollowUp;
  readonly getConversationState: GetConversationState;
  readonly closeConversation: CloseConversation;
  readonly jessyAgentService: JessyAgentService;
  readonly leadScoringService: LeadScoringService;
  readonly handoffService: HandoffService;
  readonly followUpService: FollowUpService;
}

/**
 * The composition root (Factory Pattern) — wires every real `@aos/*` integration (branch-manager's
 * `AssignLead`, dss-inventory-connector's `IInventoryQueryService`, event-bus's `IPublisher`) into
 * the use cases + services this package's public API exposes, scoped to one branch (spec persona:
 * "Per-branch awareness").
 */
export class JessyAgentFactory {
  static create(options: JessyAgentFactoryOptions): JessyAgent {
    const logger = options.logger ?? createLogger({ serviceName: "sales-agent" });
    const tracer: Tracer = options.tracer ?? getTracer("sales-agent");
    const now = options.now ?? (() => new Date());

    const agent = JessyAgentEntity.create(options.branchId, options.config.tenantId);
    const events = new JessyAgentEvents(options.publisher);

    const inventoryQuerier = new InventoryQuerier(options.inventoryQueryService);
    const responseGenerator = JessyAgentFactory.createResponseGenerator(options.config, logger);
    const conversationEngine = new ConversationEngine(
      inventoryQuerier,
      { warmThreshold: options.config.warmThreshold, hotThreshold: options.config.hotThreshold },
      responseGenerator,
      (branchId) => JessyKnowledgeBase.branch(branchId).name,
    );
    const leadScorer = new LeadScorer();
    const pipeline = new ConversationPipeline(leadScorer, conversationEngine);

    const leadScoringService = new LeadScoringService(events, options.config.hotThreshold, now);
    const handoffService = new HandoffService(
      options.assignLead,
      options.salesTeamRegistry,
      events,
      now,
    );
    const followUpService = new FollowUpService(events, options.config.noReplyTimeoutMs, now);

    const jessyAgentService = new JessyAgentService(
      pipeline,
      leadScoringService,
      handoffService,
      followUpService,
      events,
      options.config,
      now,
    );

    return {
      agent,
      processIncomingMessage: new ProcessIncomingMessage(jessyAgentService, tracer),
      triggerHandoff: new TriggerHandoff(handoffService, tracer),
      scheduleFollowUp: new ScheduleFollowUp(followUpService),
      sendFollowUp: new SendFollowUp(),
      getConversationState: new GetConversationState(jessyAgentService),
      closeConversation: new CloseConversation(jessyAgentService, events, now),
      jessyAgentService,
      leadScoringService,
      handoffService,
      followUpService,
    };
  }

  /**
   * Selects the real `IResponseGenerator` implementation (coordinator note #5's config-driven
   * toggle, mirroring `followUpEnabled`'s pattern): `LlmResponseGenerator` — wrapping the real,
   * unmodified `ResponseGenerator` as its own on-failure fallback — only when
   * `config.llmReplyEnabled` is `true` AND a non-empty `config.openaiApiKey` is present; pure
   * rule-based `ResponseGenerator` otherwise. This is the single switch that turns the LLM path
   * back off (config-only, no code change) if something goes wrong in production.
   */
  private static createResponseGenerator(
    config: SalesAgentConfig,
    logger: Logger,
  ): IResponseGenerator {
    const ruleBasedGenerator = new ResponseGenerator();
    const apiKey = config.openaiApiKey;
    if (!config.llmReplyEnabled || apiKey === undefined || apiKey.trim().length === 0) {
      return ruleBasedGenerator;
    }

    return new LlmResponseGenerator({
      client: new OpenAiChatClient({
        apiKey,
        model: config.openaiModel,
        timeoutMs: config.openaiTimeoutMs,
      }),
      fallback: ruleBasedGenerator,
      logger,
    });
  }
}
