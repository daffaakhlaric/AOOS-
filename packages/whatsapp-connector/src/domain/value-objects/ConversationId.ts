import { ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { PhoneNumber } from "./PhoneNumber.js";
import type { PhoneNumberId } from "./PhoneNumberId.js";

/**
 * A `Conversation`'s identity, deterministically derived from the pair that defines a thread —
 * `leadPhone` + `wabaPhoneNumberId` — so `ConversationService`'s in-memory map and any two
 * independently-constructed `ConversationId`s for the same pair always compare equal.
 */
export class ConversationId {
  private constructor(private readonly value: string) {}

  static fromParticipants(
    leadPhone: PhoneNumber,
    wabaPhoneNumberId: PhoneNumberId,
  ): ConversationId {
    return new ConversationId(`${wabaPhoneNumberId.toString()}::${leadPhone.toString()}`);
  }

  static create(raw: string): Result<ConversationId, ValidationError> {
    return ok(new ConversationId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: ConversationId): boolean {
    return this.value === other.value;
  }
}
