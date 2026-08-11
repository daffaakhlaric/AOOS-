import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { AgentError } from "./AgentError.js";

/** A `LeadConversation`/`ConversationMessage` construction or lookup failure (invalid state, conversation not found). */
export class ConversationError extends AgentError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}
