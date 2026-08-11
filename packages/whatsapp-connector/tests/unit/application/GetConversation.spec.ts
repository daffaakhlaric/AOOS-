import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ConversationService } from "../../../src/application/services/ConversationService.js";
import { GetConversation } from "../../../src/application/use-cases/GetConversation.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("GetConversation", () => {
  it("returns the conversation once started", () => {
    const conversations = new ConversationService();
    const leadPhone = unwrap(PhoneNumber.create("+628123456789"));
    const wabaPhoneNumberId = unwrap(PhoneNumberId.create("100000000000001"));
    const started = conversations.getOrStart(
      leadPhone,
      wabaPhoneNumberId,
      Branch.BINTARO,
      new Date(),
    );

    const useCase = new GetConversation(conversations);
    const found = unwrap(useCase.execute(started.id));
    expect(found.id.equals(started.id)).toBe(true);
  });

  it("returns NotFoundError for an unknown conversation", () => {
    const useCase = new GetConversation(new ConversationService());
    const error = unwrapErr(useCase.execute(unwrap(ConversationId.create("unknown"))));
    expect(error).toBeDefined();
  });
});
