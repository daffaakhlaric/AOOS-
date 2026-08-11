import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { MessageType } from "../../../src/domain/value-objects/MessageType.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { IncomingMessageMapper } from "../../../src/mappers/IncomingMessageMapper.js";
import type { WaWebhookMessage } from "../../../src/types/WhatsAppWebhookTypes.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const TO = unwrap(PhoneNumberId.create("100000000000001"));

describe("IncomingMessageMapper.map", () => {
  it("maps a text message", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.1",
      timestamp: "1700000000",
      type: "text",
      text: { body: "Halo kak" },
    };
    const message = unwrap(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, true));
    expect(message.type).toBe(MessageType.TEXT);
    expect(message.body?.toString()).toBe("Halo kak");
    expect(message.from.toString()).toBe("+628123456789");
    expect(message.isFirstMessage).toBe(true);
    expect(message.timestamp.getTime()).toBe(1_700_000_000 * 1000);
  });

  it("maps an interactive button_reply message, using the button title as body", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.2",
      timestamp: "1700000000",
      type: "button",
      interactive: { type: "button_reply", button_reply: { id: "yes", title: "Ya, lanjut" } },
    };
    const message = unwrap(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(message.type).toBe(MessageType.INTERACTIVE);
    expect(message.body?.toString()).toBe("Ya, lanjut");
  });

  it("maps an interactive message with no button_reply payload — no body", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.3",
      timestamp: "1700000000",
      type: "interactive",
    };
    const message = unwrap(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(message.body).toBeUndefined();
  });

  it("maps an image message with no body", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.4",
      timestamp: "1700000000",
      type: "image",
    };
    const message = unwrap(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(message.type).toBe(MessageType.IMAGE);
    expect(message.body).toBeUndefined();
  });

  it("maps a document message to MessageType.DOCUMENT", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.5",
      timestamp: "1700000000",
      type: "document",
    };
    const message = unwrap(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(message.type).toBe(MessageType.DOCUMENT);
  });

  it("maps an audio message to MessageType.DOCUMENT (no dedicated audio domain type)", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.6",
      timestamp: "1700000000",
      type: "audio",
    };
    const message = unwrap(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(message.type).toBe(MessageType.DOCUMENT);
  });

  it("rejects an unnormalizable from phone number", () => {
    const raw: WaWebhookMessage = {
      from: "+1234567890",
      id: "wamid.7",
      timestamp: "1700000000",
      type: "text",
      text: { body: "hi" },
    };
    const error = unwrapErr(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(error).toBeDefined();
  });

  it("rejects an invalid wamid", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "",
      timestamp: "1700000000",
      type: "text",
      text: { body: "hi" },
    };
    const error = unwrapErr(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(error).toBeDefined();
  });

  it("rejects a text message with no text.body", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.8",
      timestamp: "1700000000",
      type: "text",
    };
    const error = unwrapErr(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(error.message).toContain("text.body");
  });

  it("rejects a text message whose body exceeds 4096 characters", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.9",
      timestamp: "1700000000",
      type: "text",
      text: { body: "a".repeat(4097) },
    };
    const error = unwrapErr(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(error).toBeDefined();
  });

  it("rejects a non-numeric timestamp", () => {
    const raw: WaWebhookMessage = {
      from: "628123456789",
      id: "wamid.10",
      timestamp: "not-a-number",
      type: "text",
      text: { body: "hi" },
    };
    const error = unwrapErr(IncomingMessageMapper.map(raw, TO, Branch.BINTARO, false));
    expect(error.message).toContain("timestamp");
  });
});
