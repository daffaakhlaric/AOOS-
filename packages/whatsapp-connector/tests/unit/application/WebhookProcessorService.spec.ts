import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ConversationService } from "../../../src/application/services/ConversationService.js";
import { WebhookProcessorService } from "../../../src/application/services/WebhookProcessorService.js";
import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { MessageStatus } from "../../../src/domain/value-objects/MessageStatus.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import type { WaWebhookValue } from "../../../src/types/WhatsAppWebhookTypes.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const WABA = unwrap(
  WabaAccount.create({
    id: unwrap(WabaId.create("waba-1")),
    phoneNumberId: unwrap(PhoneNumberId.create("100000000000001")),
    phoneNumber: unwrap(PhoneNumber.create("+628110000001")),
    branch: Branch.BINTARO,
    displayName: "Mobix Bintaro",
    status: "ACTIVE",
    registeredAt: new Date(),
  }),
);

function valueWithMessage(): WaWebhookValue {
  return {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "+628110000001", phone_number_id: "100000000000001" },
    messages: [
      {
        from: "628123456789",
        id: "wamid.1",
        timestamp: "1700000000",
        type: "text",
        text: { body: "Halo" },
      },
    ],
  };
}

describe("WebhookProcessorService.process", () => {
  it("maps an incoming message and marks it as the first message in a new conversation", () => {
    const conversations = new ConversationService();
    const service = new WebhookProcessorService(conversations);
    const processed = unwrap(service.process(valueWithMessage(), WABA, new Date()));
    expect(processed.incoming).toHaveLength(1);
    expect(processed.incoming[0]?.isFirstMessage).toBe(true);
  });

  it("marks a second message in the same conversation as NOT first", () => {
    const conversations = new ConversationService();
    const service = new WebhookProcessorService(conversations);
    service.process(valueWithMessage(), WABA, new Date());
    const second = unwrap(service.process(valueWithMessage(), WABA, new Date()));
    expect(second.incoming[0]?.isFirstMessage).toBe(false);
  });

  it("advances the conversation's message history as a side effect", () => {
    const conversations = new ConversationService();
    const service = new WebhookProcessorService(conversations);
    const processed = unwrap(service.process(valueWithMessage(), WABA, new Date()));
    const conversationId = processed.incoming[0]?.message.conversationId;
    expect(conversationId).toBeDefined();
    if (conversationId !== undefined) {
      const conversation = unwrap(conversations.get(conversationId));
      expect(conversation.messageCount).toBe(1);
    }
  });

  it("maps status updates and records them for getStatus()", () => {
    const conversations = new ConversationService();
    const service = new WebhookProcessorService(conversations);
    const value: WaWebhookValue = {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "+628110000001", phone_number_id: "100000000000001" },
      statuses: [
        {
          id: "wamid.9",
          status: "delivered",
          timestamp: "1700000000",
          recipient_id: "628123456789",
        },
      ],
    };
    const processed = unwrap(service.process(value, WABA, new Date()));
    expect(processed.statuses).toHaveLength(1);
    expect(processed.statuses[0]?.status).toBe(MessageStatus.DELIVERED);

    const status = unwrap(service.getStatus("wamid.9"));
    expect(status.status).toBe(MessageStatus.DELIVERED);
  });

  it("getStatus returns NotFoundError for an unknown message id", () => {
    const service = new WebhookProcessorService(new ConversationService());
    const error = unwrapErr(service.getStatus("unknown-wamid"));
    expect(error.message).toContain("unknown-wamid");
  });

  it("propagates a message-mapping error even when the phone number normalizes fine (e.g. body too long)", () => {
    const service = new WebhookProcessorService(new ConversationService());
    const value: WaWebhookValue = {
      ...valueWithMessage(),
      messages: [{ ...valueWithMessage().messages![0]!, text: { body: "a".repeat(4097) } }],
    };
    const error = unwrapErr(service.process(value, WABA, new Date()));
    expect(error).toBeDefined();
  });

  it("propagates a mapping error for an unnormalizable from phone number", () => {
    const service = new WebhookProcessorService(new ConversationService());
    const value: WaWebhookValue = {
      ...valueWithMessage(),
      messages: [{ ...valueWithMessage().messages![0]!, from: "+1234567890" }],
    };
    const error = unwrapErr(service.process(value, WABA, new Date()));
    expect(error).toBeDefined();
  });

  it("propagates a mapping error for an invalid status timestamp", () => {
    const service = new WebhookProcessorService(new ConversationService());
    const value: WaWebhookValue = {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "+628110000001", phone_number_id: "100000000000001" },
      statuses: [{ id: "wamid.9", status: "sent", timestamp: "nope", recipient_id: "628" }],
    };
    const error = unwrapErr(service.process(value, WABA, new Date()));
    expect(error.message).toContain("timestamp");
  });

  it("handles a value with neither messages nor statuses", () => {
    const service = new WebhookProcessorService(new ConversationService());
    const value: WaWebhookValue = {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "+628110000001", phone_number_id: "100000000000001" },
    };
    const processed = unwrap(service.process(value, WABA, new Date()));
    expect(processed.incoming).toEqual([]);
    expect(processed.statuses).toEqual([]);
  });

  it("phoneNumberIdOf resolves the metadata phone_number_id into a PhoneNumberId", () => {
    const result = unwrap(WebhookProcessorService.phoneNumberIdOf(valueWithMessage()));
    expect(result.toString()).toBe("100000000000001");
  });
});
