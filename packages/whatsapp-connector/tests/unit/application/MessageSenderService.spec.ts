import { err, ok } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { MessageSenderService } from "../../../src/application/services/MessageSenderService.js";
import type { IWhatsAppClient } from "../../../src/contracts/IWhatsAppClient.js";
import { OutgoingMessage } from "../../../src/domain/entities/OutgoingMessage.js";
import { RateLimitError } from "../../../src/domain/errors/index.js";
import { ConversationId } from "../../../src/domain/value-objects/ConversationId.js";
import { MessageBody } from "../../../src/domain/value-objects/MessageBody.js";
import { MessageId } from "../../../src/domain/value-objects/MessageId.js";
import { MessageStatus } from "../../../src/domain/value-objects/MessageStatus.js";
import { MessageType } from "../../../src/domain/value-objects/MessageType.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { PhoneNumberRateLimiterRegistry } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const PHONE_NUMBER_ID = "100000000000001";

function preliminaryMessage() {
  const to = unwrap(PhoneNumber.create("+628123456789"));
  const from = unwrap(PhoneNumberId.create(PHONE_NUMBER_ID));
  return unwrap(
    OutgoingMessage.create({
      id: MessageId.generate(),
      to,
      from,
      branch: Branch.BINTARO,
      conversationId: ConversationId.fromParticipants(to, from),
      type: MessageType.TEXT,
      body: unwrap(MessageBody.create("Halo")),
      status: MessageStatus.SENT,
    }),
  );
}

function makeFakeClient(client: Partial<IWhatsAppClient>): IWhatsAppClient {
  return { sendText: vi.fn(), sendTemplate: vi.fn(), sendInteractive: vi.fn(), ...client };
}

describe("MessageSenderService", () => {
  it("sendText: short-circuits on local rate-limit exhaustion, never calling the client", async () => {
    const sendText = vi.fn();
    const service = new MessageSenderService({
      client: makeFakeClient({ sendText }),
      rateLimiters: new PhoneNumberRateLimiterRegistry({ capacity: 0 }),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const error = unwrapErr(
      await service.sendText(preliminaryMessage(), {
        phoneNumberId: PHONE_NUMBER_ID,
        accessToken: "t",
        to: "+628123456789",
        body: "hi",
      }),
    );
    expect(error).toBeInstanceOf(RateLimitError);
    expect(sendText).not.toHaveBeenCalled();
  });

  it("sendText: on a 429 from the client, notifies the local bucket so the next call is also throttled", async () => {
    const sendText = vi.fn().mockResolvedValueOnce(err(new RateLimitError("rate limited", 60_000)));
    const rateLimiters = new PhoneNumberRateLimiterRegistry({ capacity: 5 });
    const service = new MessageSenderService({
      client: makeFakeClient({ sendText }),
      rateLimiters,
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 }),
    });
    await service.sendText(preliminaryMessage(), {
      phoneNumberId: PHONE_NUMBER_ID,
      accessToken: "t",
      to: "+628123456789",
      body: "hi",
    });
    const status = rateLimiters.forPhoneNumberId(PHONE_NUMBER_ID).getRateLimitStatus();
    expect(status.remaining).toBe(0);
  });

  it("sendTemplate delegates to client.sendTemplate and confirms the message on success", async () => {
    const service = new MessageSenderService({
      client: makeFakeClient({
        sendTemplate: vi.fn(async () =>
          ok({
            messaging_product: "whatsapp" as const,
            contacts: [],
            messages: [{ id: "wamid.tpl" }],
          }),
        ),
      }),
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    const confirmed = unwrap(
      await service.sendTemplate(preliminaryMessage(), {
        phoneNumberId: PHONE_NUMBER_ID,
        accessToken: "t",
        to: "+628123456789",
        templateName: "hello_world",
        languageCode: "id",
        bodyParameters: [],
      }),
    );
    expect(confirmed.id.toString()).toBe("wamid.tpl");
    expect(confirmed.sentAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("sendInteractive delegates to client.sendInteractive and confirms the message on success", async () => {
    const service = new MessageSenderService({
      client: makeFakeClient({
        sendInteractive: vi.fn(async () =>
          ok({
            messaging_product: "whatsapp" as const,
            contacts: [],
            messages: [{ id: "wamid.int" }],
          }),
        ),
      }),
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const confirmed = unwrap(
      await service.sendInteractive(preliminaryMessage(), {
        phoneNumberId: PHONE_NUMBER_ID,
        accessToken: "t",
        to: "+628123456789",
        bodyText: "hi",
        buttons: [{ id: "yes", title: "Yes" }],
      }),
    );
    expect(confirmed.id.toString()).toBe("wamid.int");
  });

  it("propagates a non-retryable error straight through without consuming extra retry attempts", async () => {
    const sendText = vi.fn(async () => err(new RateLimitError("won't be reached", 0)));
    // Force a non-retryable path via maxAttempts=1 and an error that IS retryable in general,
    // but confirm the service surfaces exactly the retry pipeline's final Result unchanged.
    const service = new MessageSenderService({
      client: makeFakeClient({ sendText }),
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 1 }),
    });
    const error = unwrapErr(
      await service.sendText(preliminaryMessage(), {
        phoneNumberId: PHONE_NUMBER_ID,
        accessToken: "t",
        to: "+628123456789",
        body: "hi",
      }),
    );
    expect(error).toBeInstanceOf(RateLimitError);
    expect(sendText).toHaveBeenCalledTimes(1);
  });

  it("defaults `now` to the real clock when not provided", async () => {
    const before = Date.now();
    const service = new MessageSenderService({
      client: makeFakeClient({
        sendText: vi.fn(async () =>
          ok({
            messaging_product: "whatsapp" as const,
            contacts: [],
            messages: [{ id: "wamid.real-clock" }],
          }),
        ),
      }),
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const confirmed = unwrap(
      await service.sendText(preliminaryMessage(), {
        phoneNumberId: PHONE_NUMBER_ID,
        accessToken: "t",
        to: "+628123456789",
        body: "hi",
      }),
    );
    expect(confirmed.sentAt!.getTime()).toBeGreaterThanOrEqual(before);
  });
});
