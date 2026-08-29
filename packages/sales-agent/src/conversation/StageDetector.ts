import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";

import { DetectedIntent } from "./IntentDetector.js";

export interface StageDetectorThresholds {
  readonly warmThreshold: number;
  readonly hotThreshold: number;
}

/** Minimum inbound-message count (spec's "turn") before a WARM (not-yet-HOT) lead gets pushed toward CLOSING (AAOS-W3D Fix 1) — pinned: turn=4 triggers, turn=8 at a COLD score does not (score gates it, not turn count alone). */
const WARM_CLOSING_MIN_TURN = 4;

/** Caps repeated `CLOSING` re-attempts at 2 unless a "new signal" (the score has moved up since the last attempt) justifies another push (AAOS-W3D Fix 1 — spec: "closing not repeated more than 2x without new signal"). */
function canAttemptClosing(conversation: LeadConversation): boolean {
  if (conversation.closingAttemptCount < 2) {
    return true;
  }
  return conversation.score.toNumber() > conversation.scoreAtLastClosingAttempt;
}

/**
 * Detects the conversation stage to move INTO for the current turn (spec "StageDetector.spec.ts").
 *
 * Contract note: `conversation` here is the state AFTER `ConversationPipeline` has already
 * appended the current inbound message (needed so `inboundMessageCount`/intents reflect it) but
 * BEFORE any outbound reply is appended — so "brand-new conversation" is detected as exactly one
 * message in history (`messages.length === 1`), not zero.
 *
 * Priority order (highest first): a HOT score always routes to CLOSING (the caller —
 * `ConversationEngine`/`TriggerHandoff` — is what then moves CLOSING → HANDOFF once the handoff
 * itself succeeds) — even on a lead's very first message. An explicit price question (PRICE_INFO)
 * wins over a bare unit mention (UNIT_INFO) — e.g. "dp Brio berapa?" mentions the Brio by name but
 * is really a price question — which wins over HESITATION/COMPLAINT (OBJECTION) — both push into
 * OBJECTION identically (AAOS-W3A-S1 Fix 2: COMPLAINT is a stronger negative signal than
 * HESITATION, but doesn't get its own stage). Clara still greets a
 * brand-new conversation whose first message carries none of those stronger intents; otherwise a
 * low score with fewer than 3 prior exchanges stays in open-ended DISCOVERY. A WARM-but-not-yet-HOT
 * lead (score >= warmThreshold, < hotThreshold) that has exchanged >= 4 inbound messages also routes
 * to CLOSING (AAOS-W3D Fix 1 — the pinned turn boundary: turn=4 triggers, turn=8 at a COLD score
 * does not, since the score gate still applies), capped at 2 consecutive attempts unless the score
 * has moved since the last one (`canAttemptClosing`) so Clara doesn't nag a lead who isn't
 * responding. This is deliberately a SEPARATE, earlier-turn path from the HOT check above: it lets
 * `SimulationRunnerService` observe a genuine `... -> CLOSING` stage transition (with a real
 * test-drive/survey-mentioning message) on its own turn, before a later turn's score crossing
 * `hotThreshold` triggers `ClaraAgentService`'s immediate HANDOFF override — see
 * `ClosingAttemptScorer`'s reliance on `stageTransitions` containing a `to: CLOSING` entry.
 * Everything else falls through to QUALIFICATION.
 */
export class StageDetector {
  static detect(
    conversation: LeadConversation,
    intents: ReadonlyArray<DetectedIntent>,
    thresholds: StageDetectorThresholds,
  ): ConversationStage {
    const score = conversation.score.toNumber();

    if (score >= thresholds.hotThreshold) {
      return ConversationStage.CLOSING;
    }

    if (intents.includes(DetectedIntent.ASK_PRICE)) {
      return ConversationStage.PRICE_INFO;
    }

    if (intents.includes(DetectedIntent.ASK_UNIT)) {
      return ConversationStage.UNIT_INFO;
    }

    if (intents.includes(DetectedIntent.HESITATION) || intents.includes(DetectedIntent.COMPLAINT)) {
      return ConversationStage.OBJECTION;
    }

    if (conversation.messages.length <= 1) {
      return ConversationStage.GREETING;
    }

    if (score < thresholds.warmThreshold && conversation.inboundMessageCount < 3) {
      return ConversationStage.DISCOVERY;
    }

    if (
      score >= thresholds.warmThreshold &&
      conversation.inboundMessageCount >= WARM_CLOSING_MIN_TURN &&
      canAttemptClosing(conversation)
    ) {
      return ConversationStage.CLOSING;
    }

    return ConversationStage.QUALIFICATION;
  }
}
