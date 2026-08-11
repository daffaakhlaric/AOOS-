import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { BranchId } from "./BranchId.js";

/**
 * A `LeadConversation`'s identity, deterministically derived from the pair that defines a thread
 * — `leadPhone` + `branchId` — mirroring `@aos/whatsapp-connector`'s `ConversationId` convention
 * (`fromParticipants`), so two independently-constructed `ConversationId`s for the same
 * lead+branch always compare equal.
 */
export class ConversationId {
  private constructor(private readonly value: string) {}

  static fromParticipants(leadPhone: string, branchId: BranchId): ConversationId {
    return new ConversationId(`${branchId}::${leadPhone}`);
  }

  static create(raw: string): Result<ConversationId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(
          `ConversationId must be a non-empty string, received: ${JSON.stringify(raw)}`,
        ),
      );
    }
    return ok(new ConversationId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ConversationId): boolean {
    return this.value === other.value;
  }
}
