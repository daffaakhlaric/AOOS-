import { err, ErrorCode, ok, type Result } from "@aos/common";
import {
  ConversationId as WaConversationId,
  MessageBody,
  MessageId,
  MessageStatus,
  MessageType,
  OutgoingMessage,
  PhoneNumber,
  PhoneNumberId,
} from "@aos/whatsapp-connector";

import { AgentError } from "../../domain/errors/AgentError.js";
import { toBranch, type BranchId } from "../../domain/value-objects/BranchId.js";

/**
 * Prepares (never sends) a `@aos/whatsapp-connector` `OutgoingMessage` — the shared helper behind
 * design resolution #5: Clara's use cases return a prepared, `OutgoingMessage`-shaped payload,
 * never call a real send/`SendTextMessage`-style method. `from` is a synthetic
 * `waba-<branchId>` `PhoneNumberId` placeholder: this package has no real WABA `phone_number_id`
 * config of its own (that lives in `@aos/whatsapp-connector`'s `WabaRegistry`, out of Clara's
 * explicit scope) — the placeholder is exactly the shape a real one would take, which is all a
 * "prepared, not sent" payload needs.
 */
export function prepareOutgoingMessage(
  leadPhone: string,
  branchId: BranchId,
  text: string,
): Result<OutgoingMessage, AgentError> {
  const toResult = PhoneNumber.create(leadPhone);
  if (!toResult.ok) {
    return err(
      new AgentError(ErrorCode.VALIDATION_ERROR, toResult.error.message, { cause: toResult.error }),
    );
  }
  const fromResult = PhoneNumberId.create(`waba-${branchId}`);
  /* v8 ignore start -- the synthetic `waba-<branchId>` string is always non-empty by construction. */
  if (!fromResult.ok) {
    return err(
      new AgentError(ErrorCode.VALIDATION_ERROR, fromResult.error.message, {
        cause: fromResult.error,
      }),
    );
  }
  /* v8 ignore stop */
  const bodyResult = MessageBody.create(text);
  if (!bodyResult.ok) {
    return err(
      new AgentError(ErrorCode.VALIDATION_ERROR, bodyResult.error.message, {
        cause: bodyResult.error,
      }),
    );
  }

  const messageResult = OutgoingMessage.create({
    id: MessageId.generate(),
    to: toResult.value,
    from: fromResult.value,
    branch: toBranch(branchId),
    conversationId: WaConversationId.fromParticipants(toResult.value, fromResult.value),
    type: MessageType.TEXT,
    body: bodyResult.value,
    status: MessageStatus.SENT,
  });
  /* v8 ignore start -- `type`/`status` above are always valid literals, the only 2 things `OutgoingMessage.create` validates. */
  if (!messageResult.ok) {
    return err(
      new AgentError(ErrorCode.VALIDATION_ERROR, messageResult.error.message, {
        cause: messageResult.error,
      }),
    );
  }
  /* v8 ignore stop */
  return ok(messageResult.value);
}
