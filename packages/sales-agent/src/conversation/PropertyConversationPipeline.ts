import { err, ErrorCode, ok, type Result } from "@aos/common";

import type { IPropertyConversationEngine } from "../contracts/IPropertyConversationEngine.js";
import type { IPropertyLeadScorer } from "../contracts/IPropertyLeadScorer.js";
import { ConversationMessage, MessageDirection } from "../domain/entities/ConversationMessage.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { PropertyListing } from "../domain/entities/PropertyListing.js";
import { AgentError } from "../domain/errors/AgentError.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";
import type { PropertyScoreDelta } from "../domain/value-objects/PropertyScoreDelta.js";

export interface PropertyPipelineResult {
  readonly conversation: LeadConversation;
  readonly responseText: string;
  readonly appliedDeltas: ReadonlyArray<PropertyScoreDelta>;
  readonly matchedListings: ReadonlyArray<PropertyListing>;
}

/**
 * PROPERTY-vertical sibling to `ConversationPipeline` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY
 * Phase 8, spec section 12 point 2): processes one inbound message through Jessy's PROPERTY
 * Perceive → Reason → Act pipeline — appends the inbound message, applies every
 * `IPropertyLeadScorer` delta (clamped via `LeadScore.apply`), delegates the stage/response
 * decision to `IPropertyConversationEngine`, then appends Jessy's outbound reply.
 *
 * Deliberately does NOT call `LeadProfileBuilder.enrich`/`QualificationDetector.detect`/
 * `nextCriterionToAsk`/`withAskedCriterion` the way the automotive pipeline does — confirmed via
 * direct read that `PropertyConversationEngine`/`PropertyStageDetector`/`PropertyResponseGenerator`
 * never read `LeadConversation.profile`/`askedCriteria` (`nextPropertyCriterionToAsk` is a pure
 * function of the conversation's own message history instead, per its own docstring — Phase 7's
 * explicit scoped-down decision not to extend automotive's `QualificationStatus`-typed profile
 * state to PROPERTY). Closing-attempt bookkeeping (`withClosingAttempt`) is reused as-is: it is
 * generic `LeadConversation` state `PropertyStageDetector.canAttemptClosing` already reads.
 */
export class PropertyConversationPipeline {
  constructor(
    private readonly leadScorer: IPropertyLeadScorer,
    private readonly conversationEngine: IPropertyConversationEngine,
  ) {}

  async process(
    conversation: LeadConversation,
    messageText: string,
    now: Date,
  ): Promise<Result<PropertyPipelineResult, AgentError>> {
    const inboundResult = ConversationMessage.create({
      text: messageText,
      direction: MessageDirection.INBOUND,
      occurredAt: now,
    });
    if (!inboundResult.ok) {
      return err(
        new AgentError(ErrorCode.VALIDATION_ERROR, inboundResult.error.message, {
          cause: inboundResult.error,
        }),
      );
    }

    const withInbound = conversation.withAppendedMessage(inboundResult.value, now);

    const appliedDeltas = this.leadScorer.score(messageText);
    const newScore = appliedDeltas.reduce(
      (score, delta) => score.apply(delta.amount),
      withInbound.score,
    );

    const scoredConversation = withInbound.withScore(newScore);

    const decisionResult = await this.conversationEngine.decide(scoredConversation, messageText);
    if (!decisionResult.ok) {
      return decisionResult;
    }
    const decision = decisionResult.value;

    const outboundResult = ConversationMessage.create({
      text: decision.responseText,
      direction: MessageDirection.OUTBOUND,
      occurredAt: now,
    });
    /* v8 ignore start -- `decision.responseText` is always produced by `PropertyResponseGenerator`,
       whose every branch returns a non-empty, pre-truncated (<=200 char) string, so this can never
       fail (mirrors `ConversationPipeline.ts`'s automotive equivalent). */
    if (!outboundResult.ok) {
      return err(
        new AgentError(ErrorCode.VALIDATION_ERROR, outboundResult.error.message, {
          cause: outboundResult.error,
        }),
      );
    }
    /* v8 ignore stop */

    let finalConversation = scoredConversation
      .withStage(decision.nextStage)
      .withAppendedMessage(outboundResult.value, now);

    if (decision.nextStage === ConversationStage.CLOSING) {
      finalConversation = finalConversation.withClosingAttempt();
    }

    return ok({
      conversation: finalConversation,
      responseText: decision.responseText,
      appliedDeltas,
      matchedListings: decision.matchedListings,
    });
  }
}
