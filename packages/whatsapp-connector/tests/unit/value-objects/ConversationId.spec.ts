import { describe, expect, it } from "vitest";

import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap } from "../../helpers/result.js";

describe("ConversationId", () => {
  it("fromParticipants is deterministic for the same lead+WABA pair", () => {
    const phone = unwrap(PhoneNumber.create("+628123456789"));
    const wabaPhoneNumberId = unwrap(PhoneNumberId.create("100000000000001"));

    const a = ConversationId.fromParticipants(phone, wabaPhoneNumberId);
    const b = ConversationId.fromParticipants(phone, wabaPhoneNumberId);
    expect(a.equals(b)).toBe(true);
    expect(a.toString()).toBe(b.toString());
  });

  it("fromParticipants differs across WABA numbers for the same lead", () => {
    const phone = unwrap(PhoneNumber.create("+628123456789"));
    const waba1 = unwrap(PhoneNumberId.create("100000000000001"));
    const waba2 = unwrap(PhoneNumberId.create("100000000000002"));

    const a = ConversationId.fromParticipants(phone, waba1);
    const b = ConversationId.fromParticipants(phone, waba2);
    expect(a.equals(b)).toBe(false);
  });

  it("create() wraps a raw string", () => {
    const result = ConversationId.create("raw-id");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe("raw-id");
    }
  });
});
