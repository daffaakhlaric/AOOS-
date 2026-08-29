import { err, ErrorCode, ok, type Result } from "@aos/common";
import type { OutgoingMessage } from "@aos/whatsapp-connector";

import type { SalesAgentConfig } from "../../config/SalesAgentConfig.js";
import type { PropertyConversationPipeline } from "../../conversation/PropertyConversationPipeline.js";
import { LeadConversation } from "../../domain/entities/LeadConversation.js";
import { AgentError } from "../../domain/errors/AgentError.js";
import { ConversationError } from "../../domain/errors/ConversationError.js";
import type { ClaraAgentEvents } from "../../domain/events/ClaraAgentEvents.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import { ConversationId } from "../../domain/value-objects/ConversationId.js";
import { ConversationStage } from "../../domain/value-objects/ConversationStage.js";
import {
  classifyTemperature,
  LeadTemperature,
} from "../../domain/value-objects/LeadTemperature.js";

import type { FollowUpService } from "./FollowUpService.js";
import { prepareOutgoingMessage } from "./OutgoingMessagePreparer.js";
import type { PropertyHandoffOutcome, PropertyHandoffService } from "./PropertyHandoffService.js";
import type { PropertyLeadScoringService } from "./PropertyLeadScoringService.js";

export interface ProcessMessageInput {
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly messageText: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface ProcessMessageOutcome {
  readonly conversation: LeadConversation;
  readonly outgoingMessage: OutgoingMessage;
  readonly temperature: LeadTemperature;
  readonly becameHot: boolean;
  readonly handoff?: PropertyHandoffOutcome;
}

/**
 * PROPERTY-vertical sibling to `ClaraAgentService` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8,
 * spec section 12 point 1/2): orchestrates Clara's full PROPERTY message-processing flow —
 * `PropertyConversationPipeline` for perceive/reason/act, `PropertyLeadScoringService` for scoring,
 * `PropertyHandoffService` for HOT-lead handoff. `FollowUpService` is reused as-is (confirmed via
 * direct read to depend only on `ClaraAgentEvents`/thresholds/clock — genuinely vertical-generic,
 * unlike `LeadScoringService`/`HandoffService`).
 */
export class PropertyClaraAgentService {
  private readonly conversations = new Map<string, LeadConversation>();

  constructor(
    private readonly pipeline: PropertyConversationPipeline,
    private readonly scoringService: PropertyLeadScoringService,
    private readonly handoffService: PropertyHandoffService,
    private readonly followUpService: FollowUpService,
    private readonly events: ClaraAgentEvents,
    private readonly config: SalesAgentConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private key(leadPhone: string, branchId: BranchId): string {
    return ConversationId.fromParticipants(leadPhone, branchId).toString();
  }

  getOrStart(
    leadPhone: string,
    branchId: BranchId,
  ): { conversation: LeadConversation; isNew: boolean } {
    const key = this.key(leadPhone, branchId);
    const existing = this.conversations.get(key);
    if (existing !== undefined) {
      return { conversation: existing, isNew: false };
    }
    const created = LeadConversation.start(leadPhone, branchId, this.now());
    this.conversations.set(key, created);
    return { conversation: created, isNew: true };
  }

  get(conversationId: ConversationId): Result<LeadConversation, ConversationError> {
    const found = [...this.conversations.values()].find((c) => c.id.equals(conversationId));
    if (found === undefined) {
      return err(
        new ConversationError(`No conversation found for id "${conversationId.toString()}"`),
      );
    }
    return ok(found);
  }

  async processMessage(
    input: ProcessMessageInput,
  ): Promise<Result<ProcessMessageOutcome, AgentError>> {
    const { conversation: startingConversation, isNew } = this.getOrStart(
      input.leadPhone,
      input.branchId,
    );

    if (isNew) {
      await this.events.publishConversationStarted({
        conversationId: startingConversation.id.toString(),
        leadPhone: input.leadPhone,
        branchId: input.branchId,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt: this.now(),
        version: "1.0",
      });
    }

    const pipelineResult = await this.pipeline.process(
      startingConversation,
      input.messageText,
      this.now(),
    );
    if (!pipelineResult.ok) {
      return pipelineResult;
    }
    const {
      conversation: pipelinedConversation,
      appliedDeltas,
      matchedListings,
    } = pipelineResult.value;

    const scoringOutcome = await this.scoringService.recordScoring({
      conversationId: pipelinedConversation.id.toString(),
      leadPhone: input.leadPhone,
      branchId: input.branchId,
      previousScore: startingConversation.score,
      appliedDeltas,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    });

    let conversation = pipelinedConversation.withScore(scoringOutcome.newScore);

    await this.events.publishMessageProcessed({
      conversationId: conversation.id.toString(),
      leadPhone: input.leadPhone,
      stage: conversation.stage,
      score: conversation.score.toNumber(),
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    const outgoingResult = prepareOutgoingMessage(
      input.leadPhone,
      input.branchId,
      pipelineResult.value.responseText,
    );
    if (!outgoingResult.ok) {
      return outgoingResult;
    }

    const temperature = classifyTemperature(
      conversation.score.toNumber(),
      this.config.warmThreshold,
      this.config.hotThreshold,
    );

    let handoff: PropertyHandoffOutcome | undefined;
    if (scoringOutcome.becameHot) {
      conversation = conversation.withStage(ConversationStage.HANDOFF);
      const handoffResult = await this.handoffService.handoff({
        conversation,
        matchedListings,
        tenantId: input.tenantId,
        correlationId: input.correlationId,
      });
      if (!handoffResult.ok) {
        return err(
          new AgentError(ErrorCode.UNAVAILABLE, handoffResult.error.message, {
            cause: handoffResult.error,
          }),
        );
      }
      handoff = handoffResult.value;
    } else if (
      this.config.followUpEnabled &&
      (temperature === LeadTemperature.COLD || temperature === LeadTemperature.WARM)
    ) {
      await this.followUpService.scheduleAndEmit(
        conversation,
        temperature,
        input.tenantId,
        input.correlationId,
      );
    }

    this.conversations.set(this.key(input.leadPhone, input.branchId), conversation);

    return ok({
      conversation,
      outgoingMessage: outgoingResult.value,
      temperature,
      becameHot: scoringOutcome.becameHot,
      handoff,
    });
  }

  /** Marks a conversation as `CLOSED` — used by `PropertyCloseConversation`. */
  close(conversationId: ConversationId): Result<LeadConversation, ConversationError> {
    const found = this.get(conversationId);
    if (!found.ok) {
      return found;
    }
    const closed = found.value.withStage(ConversationStage.CLOSED).withClosed(true);
    this.conversations.set(this.key(closed.leadPhone, closed.branchId), closed);
    return ok(closed);
  }
}
