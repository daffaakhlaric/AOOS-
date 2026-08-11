import { describe, expect, it } from "vitest";

import {
  ConversationMessage,
  MessageDirection,
} from "../../../../src/domain/entities/ConversationMessage.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ConversationMessage", () => {
  const at = new Date("2026-08-10T09:00:00.000Z");

  it("create() builds an INBOUND message", () => {
    const message = unwrap(
      ConversationMessage.create({
        text: "halo min",
        direction: MessageDirection.INBOUND,
        occurredAt: at,
      }),
    );
    expect(message.text).toBe("halo min");
    expect(message.direction).toBe(MessageDirection.INBOUND);
    expect(message.occurredAt).toBe(at);
    expect(message.isInbound).toBe(true);
  });

  it("create() builds an OUTBOUND message", () => {
    const message = unwrap(
      ConversationMessage.create({
        text: "Hai kak!",
        direction: MessageDirection.OUTBOUND,
        occurredAt: at,
      }),
    );
    expect(message.isInbound).toBe(false);
  });

  it("create() rejects an empty text", () => {
    expect(
      unwrapErr(
        ConversationMessage.create({
          text: "",
          direction: MessageDirection.INBOUND,
          occurredAt: at,
        }),
      ).message,
    ).toContain("non-empty");
  });

  it("create() rejects a whitespace-only text", () => {
    expect(
      unwrapErr(
        ConversationMessage.create({
          text: "   ",
          direction: MessageDirection.INBOUND,
          occurredAt: at,
        }),
      ).message,
    ).toContain("non-empty");
  });

  it("create() rejects an invalid direction", () => {
    expect(
      unwrapErr(
        ConversationMessage.create({
          text: "hi",
          direction: "SIDEWAYS" as MessageDirection,
          occurredAt: at,
        }),
      ).message,
    ).toContain("MessageDirection");
  });
});
