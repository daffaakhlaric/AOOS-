import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ConversationService } from "../../../src/application/services/ConversationService.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap } from "../../helpers/result.js";

const LEAD = unwrap(PhoneNumber.create("+628123456789"));
const WABA = unwrap(PhoneNumberId.create("100000000000001"));

describe("ConversationService", () => {
  it("isNewConversation is true before any conversation is started", () => {
    const service = new ConversationService();
    expect(service.isNewConversation(LEAD, WABA)).toBe(true);
  });

  it("getOrStart creates a fresh ACTIVE conversation with zero messages", () => {
    const service = new ConversationService();
    const at = new Date("2026-01-01T00:00:00.000Z");
    const conversation = service.getOrStart(LEAD, WABA, Branch.BINTARO, at);
    expect(conversation.status).toBe("ACTIVE");
    expect(conversation.messageCount).toBe(0);
    expect(conversation.startedAt).toEqual(at);
  });

  it("getOrStart returns the SAME conversation on a second call for the same pair", () => {
    const service = new ConversationService();
    const first = service.getOrStart(LEAD, WABA, Branch.BINTARO, new Date());
    const second = service.getOrStart(LEAD, WABA, Branch.BINTARO, new Date());
    expect(second).toBe(first);
  });

  it("isNewConversation becomes false after getOrStart", () => {
    const service = new ConversationService();
    service.getOrStart(LEAD, WABA, Branch.BINTARO, new Date());
    expect(service.isNewConversation(LEAD, WABA)).toBe(false);
  });

  it("appendMessage advances the conversation and is reflected in get()", () => {
    const service = new ConversationService();
    const conversation = service.getOrStart(LEAD, WABA, Branch.BINTARO, new Date());
    const messageId = MessageId.generate();
    const at = new Date("2026-01-02T00:00:00.000Z");
    const updated = service.appendMessage(conversation.id, messageId, at);
    expect(updated.messageCount).toBe(1);
    expect(updated.lastMessageAt).toEqual(at);

    const fetched = unwrap(service.get(conversation.id));
    expect(fetched.messageCount).toBe(1);
  });

  it("get() returns NotFoundError for an unknown conversation id", () => {
    const service = new ConversationService();
    const result = service.get(unwrap(ConversationId.create("unknown-id")));
    expect(result.ok).toBe(false);
  });

  it("listAll returns every started conversation", () => {
    const service = new ConversationService();
    service.getOrStart(LEAD, WABA, Branch.BINTARO, new Date());
    const otherLead = unwrap(PhoneNumber.create("+628199999999"));
    service.getOrStart(otherLead, WABA, Branch.BINTARO, new Date());
    expect(service.listAll()).toHaveLength(2);
  });
});
