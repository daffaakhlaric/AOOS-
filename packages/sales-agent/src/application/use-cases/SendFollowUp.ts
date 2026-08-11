import type { Result } from "@aos/common";
import type { OutgoingMessage } from "@aos/whatsapp-connector";

import type { AgentError } from "../../domain/errors/AgentError.js";
import type { BranchId } from "../../domain/value-objects/BranchId.js";
import type { FollowUpDay } from "../../domain/value-objects/FollowUpDay.js";
import { getFollowUpMessage } from "../../responses/FollowUpResponses.js";
import { prepareOutgoingMessage } from "../services/OutgoingMessagePreparer.js";

export interface SendFollowUpInput {
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly day: FollowUpDay;
  /** Deterministic pool-selection seed (design resolution #4) — in practice the lead's message count at schedule time. */
  readonly seed: number;
}

/** Prepares (never sends — design resolution #5) the D1/D3/D7/D14 follow-up `OutgoingMessage` for one scheduled entry (spec "SendFollowUp.ts"). */
export class SendFollowUp {
  execute(input: SendFollowUpInput): Result<OutgoingMessage, AgentError> {
    const text = getFollowUpMessage(input.day, input.seed);
    return prepareOutgoingMessage(input.leadPhone, input.branchId, text);
  }
}
