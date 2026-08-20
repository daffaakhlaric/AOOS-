import type { AssignLead, SalesTeamRegistry } from "@aos/branch-manager";
import type { IInventoryQueryService } from "@aos/dss-inventory-connector";
import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { FollowUpService } from "../application/services/FollowUpService.js";
import { HandoffService } from "../application/services/HandoffService.js";
import { JessyAgentService } from "../application/services/JessyAgentService.js";
import { LeadScoringService } from "../application/services/LeadScoringService.js";
import { PropertyHandoffService } from "../application/services/PropertyHandoffService.js";
import { PropertyJessyAgentService } from "../application/services/PropertyJessyAgentService.js";
import { PropertyLeadScoringService } from "../application/services/PropertyLeadScoringService.js";
import type { Tracer } from "../application/tracer.js";
import { CloseConversation } from "../application/use-cases/CloseConversation.js";
import { GetConversationState } from "../application/use-cases/GetConversationState.js";
import { ProcessIncomingMessage } from "../application/use-cases/ProcessIncomingMessage.js";
import { PropertyCloseConversation } from "../application/use-cases/PropertyCloseConversation.js";
import { PropertyGetConversationState } from "../application/use-cases/PropertyGetConversationState.js";
import { PropertyProcessIncomingMessage } from "../application/use-cases/PropertyProcessIncomingMessage.js";
import { PropertyTriggerHandoff } from "../application/use-cases/PropertyTriggerHandoff.js";
import { ScheduleFollowUp } from "../application/use-cases/ScheduleFollowUp.js";
import { SendFollowUp } from "../application/use-cases/SendFollowUp.js";
import { TriggerHandoff } from "../application/use-cases/TriggerHandoff.js";
import type { SalesAgentConfig } from "../config/SalesAgentConfig.js";
import type { IListingQueryService } from "../contracts/IListingQueryService.js";
import type { IResponseGenerator } from "../contracts/IResponseGenerator.js";
import { ConversationEngine } from "../conversation/ConversationEngine.js";
import { ConversationPipeline } from "../conversation/ConversationPipeline.js";
import { PropertyConversationEngine } from "../conversation/PropertyConversationEngine.js";
import { PropertyConversationPipeline } from "../conversation/PropertyConversationPipeline.js";
import { PropertyResponseGenerator } from "../conversation/PropertyResponseGenerator.js";
import { ResponseGenerator } from "../conversation/ResponseGenerator.js";
import { JessyAgent as JessyAgentEntity } from "../domain/entities/JessyAgent.js";
import { JessyAgentEvents } from "../domain/events/JessyAgentEvents.js";
import type { BranchId } from "../domain/value-objects/BranchId.js";
import { InventoryQuerier } from "../intelligence/InventoryQuerier.js";
import { JessyKnowledgeBase } from "../intelligence/JessyKnowledgeBase.js";
import { ListingQuerier } from "../intelligence/ListingQuerier.js";
import { LlmResponseGenerator } from "../llm/LlmResponseGenerator.js";
import { OpenAiChatClient } from "../llm/OpenAiChatClient.js";
import { LeadScorer } from "../scoring/LeadScorer.js";
import { PropertyLeadScorer } from "../scoring/PropertyLeadScorer.js";
import {
  PROPERTY_HOT_THRESHOLD,
  PROPERTY_WARM_THRESHOLD,
} from "../scoring/PropertyScoreCalculator.js";

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

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 7 (spec section 11 point 2) — options for the
 * vertical-aware PROPERTY composition path, `createPropertyConversationEngine`. Deliberately a
 * separate, smaller options shape (not a superset of `JessyAgentFactoryOptions`): the PROPERTY path
 * composes only the new PROPERTY conversation stack (`ListingQuerier`/`PropertyResponseGenerator`/
 * `PropertyConversationEngine`) — it does NOT yet compose a full PROPERTY `JessyAgent`
 * (`ConversationPipeline`/`JessyAgentService`/`LeadScoringService`/... remain automotive-typed,
 * `IConversationEngine`-only; giving them a real PROPERTY-vertical sibling too is further,
 * out-of-scope work for a future phase — see the coordinator report).
 */
export interface PropertyConversationEngineFactoryOptions {
  readonly branchId: BranchId;
  /** Real `IListingQueryService` — queried for real by `ListingQuerier`, never mocked. */
  readonly listingQueryService: IListingQueryService;
  /** Defaults to `PROPERTY_WARM_THRESHOLD`/`PROPERTY_HOT_THRESHOLD` (spec Part 6). */
  readonly warmThreshold?: number;
  readonly hotThreshold?: number;
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
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8 (spec section 12 points 1/2) — options for
 * `createPropertyAgent`, the PROPERTY-vertical sibling to `JessyAgentFactoryOptions`. Deliberately
 * mirrors `JessyAgentFactoryOptions`'s shape (not `PropertyConversationEngineFactoryOptions`'s
 * narrower one — Phase 8 composes the FULL PROPERTY `JessyAgent`, not just the `decide()` engine),
 * swapping `inventoryQueryService` for `listingQueryService`.
 */
export interface PropertyJessyAgentFactoryOptions {
  readonly config: SalesAgentConfig;
  readonly branchId: BranchId;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied. */
  readonly publisher: IPublisher;
  /** Real `@aos/branch-manager` `AssignLead` use case — called for real by `PropertyHandoffService`, never mocked. */
  readonly assignLead: AssignLead;
  /** Real `@aos/branch-manager` `SalesTeamRegistry` — used to resolve the assigned sales human's display name. */
  readonly salesTeamRegistry: SalesTeamRegistry;
  /** Real `IListingQueryService` — queried for real by `ListingQuerier`, never mocked. */
  readonly listingQueryService: IListingQueryService;
  /** Defaults to `PROPERTY_WARM_THRESHOLD`/`PROPERTY_HOT_THRESHOLD` (spec Part 6) — overrides `config.warmThreshold`/`config.hotThreshold` so the composed engine, scoring service, and temperature classification all agree on the same PROPERTY-tuned thresholds. */
  readonly warmThreshold?: number;
  readonly hotThreshold?: number;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock — defaults to the real wall clock only here. */
  readonly now?: () => Date;
}

/** The full PROPERTY-vertical composition `createPropertyAgent` returns — the sibling to `JessyAgent`. */
export interface PropertyJessyAgent {
  readonly agent: JessyAgentEntity;
  readonly processIncomingMessage: PropertyProcessIncomingMessage;
  readonly triggerHandoff: PropertyTriggerHandoff;
  readonly scheduleFollowUp: ScheduleFollowUp;
  readonly sendFollowUp: SendFollowUp;
  readonly getConversationState: PropertyGetConversationState;
  readonly closeConversation: PropertyCloseConversation;
  readonly jessyAgentService: PropertyJessyAgentService;
  readonly leadScoringService: PropertyLeadScoringService;
  readonly handoffService: PropertyHandoffService;
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
   * The PROPERTY-vertical sibling composition to `create()`'s automotive `ConversationEngine`
   * wiring (spec section 11 point 2): wires the real `ListingQuerier`/`PropertyResponseGenerator`
   * into a `PropertyConversationEngine`, scoped to one branch exactly like the automotive path.
   */
  static createPropertyConversationEngine(
    options: PropertyConversationEngineFactoryOptions,
  ): PropertyConversationEngine {
    const listingQuerier = new ListingQuerier(options.listingQueryService);
    const responseGenerator = new PropertyResponseGenerator();
    return new PropertyConversationEngine(
      listingQuerier,
      {
        warmThreshold: options.warmThreshold ?? PROPERTY_WARM_THRESHOLD,
        hotThreshold: options.hotThreshold ?? PROPERTY_HOT_THRESHOLD,
      },
      responseGenerator,
      (branchId) => JessyKnowledgeBase.branch(branchId).name,
    );
  }

  /**
   * The PROPERTY-vertical sibling to `create()` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8,
   * spec section 12 points 1/2) — composes the FULL PROPERTY `JessyAgent`
   * (pipeline+service+scoring+handoff+followUp), not just the `decide()` engine
   * `createPropertyConversationEngine` builds. `FollowUpService` is reused as-is (confirmed
   * genuinely vertical-generic); `PropertyLeadScoringService`/`PropertyHandoffService` are real,
   * additive siblings to `LeadScoringService`/`HandoffService` (both confirmed concretely
   * automotive-typed via direct read, not vertical-generic as originally assumed).
   */
  static createPropertyAgent(options: PropertyJessyAgentFactoryOptions): PropertyJessyAgent {
    const tracer: Tracer = options.tracer ?? getTracer("sales-agent");
    const now = options.now ?? (() => new Date());

    const warmThreshold = options.warmThreshold ?? PROPERTY_WARM_THRESHOLD;
    const hotThreshold = options.hotThreshold ?? PROPERTY_HOT_THRESHOLD;
    const propertyConfig: SalesAgentConfig = { ...options.config, warmThreshold, hotThreshold };

    const agent = JessyAgentEntity.create(options.branchId, propertyConfig.tenantId);
    const events = new JessyAgentEvents(options.publisher);

    const conversationEngine = JessyAgentFactory.createPropertyConversationEngine({
      branchId: options.branchId,
      listingQueryService: options.listingQueryService,
      warmThreshold,
      hotThreshold,
    });
    const leadScorer = new PropertyLeadScorer();
    const pipeline = new PropertyConversationPipeline(leadScorer, conversationEngine);

    const leadScoringService = new PropertyLeadScoringService(events, hotThreshold, now);
    const handoffService = new PropertyHandoffService(
      options.assignLead,
      options.salesTeamRegistry,
      events,
      now,
    );
    const followUpService = new FollowUpService(events, propertyConfig.noReplyTimeoutMs, now);

    const jessyAgentService = new PropertyJessyAgentService(
      pipeline,
      leadScoringService,
      handoffService,
      followUpService,
      events,
      propertyConfig,
      now,
    );

    return {
      agent,
      processIncomingMessage: new PropertyProcessIncomingMessage(jessyAgentService, tracer),
      triggerHandoff: new PropertyTriggerHandoff(handoffService, tracer),
      scheduleFollowUp: new ScheduleFollowUp(followUpService),
      sendFollowUp: new SendFollowUp(),
      getConversationState: new PropertyGetConversationState(jessyAgentService),
      closeConversation: new PropertyCloseConversation(jessyAgentService, events, now),
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
