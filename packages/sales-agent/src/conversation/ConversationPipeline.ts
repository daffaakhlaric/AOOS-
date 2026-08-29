import { err, ErrorCode, ok, type Result } from "@aos/common";
import type { InventoryUnit } from "@aos/dss-inventory-connector";

import { LeadProfileBuilder } from "../builders/LeadProfileBuilder.js";
import type { IConversationEngine } from "../contracts/IConversationEngine.js";
import type { ILeadScorer } from "../contracts/ILeadScorer.js";
import { ConversationMessage, MessageDirection } from "../domain/entities/ConversationMessage.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import { AgentError } from "../domain/errors/AgentError.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";
import type { ScoreDelta } from "../domain/value-objects/ScoreDelta.js";
import { nextCriterionToAsk } from "../responses/QualificationResponses.js";
import { QualificationDetector } from "../scoring/QualificationDetector.js";

export interface PipelineResult {
  readonly conversation: LeadConversation;
  readonly responseText: string;
  readonly appliedDeltas: ReadonlyArray<ScoreDelta>;
  readonly matchedUnits: ReadonlyArray<InventoryUnit>;
}

/**
 * Processes one inbound message through Clara's full Perceive → Reason → Act pipeline (spec
 * "conversation/ConversationPipeline.ts"): appends the inbound message, applies every
 * `ILeadScorer` delta (clamped via `LeadScore.apply` — design resolution #6), enriches the
 * `LeadProfile` via `QualificationDetector`, delegates the stage/response decision to
 * `IConversationEngine`, then appends Clara's outbound reply.
 */
export class ConversationPipeline {
  constructor(
    private readonly leadScorer: ILeadScorer,
    private readonly conversationEngine: IConversationEngine,
  ) {}

  async process(
    conversation: LeadConversation,
    messageText: string,
    now: Date,
  ): Promise<Result<PipelineResult, AgentError>> {
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
    const qualificationMatches = QualificationDetector.detect(messageText);
    const newProfile = LeadProfileBuilder.enrich(withInbound.profile, qualificationMatches);

    const scoredConversation = withInbound.withScore(newScore).withProfile(newProfile);

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
    /* v8 ignore start -- `decision.responseText` is always produced by `ResponseGenerator`, whose
       every branch returns a non-empty, pre-truncated (<=300 char) string, so this can never fail. */
    if (!outboundResult.ok) {
      return err(
        new AgentError(ErrorCode.VALIDATION_ERROR, outboundResult.error.message, {
          cause: outboundResult.error,
        }),
      );
    }
    /* v8 ignore stop */

    // AAOS-W3D Fix 3: `nextCriterionToAsk` is called against `scoredConversation` — the exact same
    // conversation object `IConversationEngine.decide`/`ResponseGenerator` just saw — so this
    // reproduces, deterministically, whichever criterion (if any) the QUALIFICATION-stage response
    // actually asked about, letting `askedCriteria` stay in sync without `EngineDecision` needing
    // its own copy of that decision.
    const qualificationCriterion =
      decision.nextStage === ConversationStage.QUALIFICATION
        ? nextCriterionToAsk(scoredConversation)
        : undefined;

    let finalConversation = scoredConversation
      .withStage(decision.nextStage)
      .withAppendedMessage(outboundResult.value, now);

    // AAOS-W3D Fix 1: records this turn's closing push so `StageDetector`'s 2-attempt cap
    // (`canAttemptClosing`) and `ResponseGenerator`'s WARM-vs-FOLLOW pool choice both see it on the
    // NEXT turn.
    if (decision.nextStage === ConversationStage.CLOSING) {
      finalConversation = finalConversation.withClosingAttempt();
    }
    if (qualificationCriterion !== undefined) {
      finalConversation = finalConversation.withAskedCriterion(qualificationCriterion);
    }

    return ok({
      conversation: finalConversation,
      responseText: decision.responseText,
      appliedDeltas,
      matchedUnits: decision.matchedUnits,
    });
  }
}
