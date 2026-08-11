import { err, ok } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { MessageSenderService } from "../../../src/application/services/MessageSenderService.js";
import type { Tracer } from "../../../src/application/tracer.js";
import { SendTextMessage } from "../../../src/application/use-cases/SendTextMessage.js";
import type { IWhatsAppClient } from "../../../src/contracts/IWhatsAppClient.js";
import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { AuthError } from "../../../src/domain/errors/index.js";
import { WhatsAppConnectorEvents } from "../../../src/domain/events/WhatsAppConnectorEvents.js";
import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../../src/domain/value-objects/WabaId.js";
import { PhoneNumberRateLimiterRegistry } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { WabaRegistry } from "../../../src/registry/WabaRegistry.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const PHONE_NUMBER_ID = "100000000000001";

function spyTracer(): { tracer: Tracer; spanNames: string[] } {
  const spanNames: string[] = [];
  const tracer = {
    startActiveSpan: (name: string, fn: (span: { end: () => void }) => unknown) => {
      spanNames.push(name);
      return fn({ end: () => undefined });
    },
  } as unknown as Tracer;
  return { tracer, spanNames };
}

function makeRegistry() {
  const registry = new WabaRegistry();
  registry.register(
    unwrap(
      WabaAccount.create({
        id: unwrap(WabaId.create("waba-1")),
        phoneNumberId: unwrap(PhoneNumberId.create(PHONE_NUMBER_ID)),
        phoneNumber: unwrap(PhoneNumber.create("+628110000001")),
        branch: Branch.BINTARO,
        displayName: "Mobix Bintaro",
        status: "ACTIVE",
        registeredAt: new Date(),
      }),
    ),
  );
  return registry;
}

function makeFakeClient(client: Partial<IWhatsAppClient>): IWhatsAppClient {
  return {
    sendText: vi.fn(),
    sendTemplate: vi.fn(),
    sendInteractive: vi.fn(),
    ...client,
  };
}

describe("SendTextMessage (unit, hand-rolled IWhatsAppClient double)", () => {
  it("emits MessageSent with the exact spec-mandated payload shape", async () => {
    const client = makeFakeClient({
      sendText: vi.fn(async () =>
        ok({
          messaging_product: "whatsapp" as const,
          contacts: [{ input: "+628123456789", wa_id: "628123456789" }],
          messages: [{ id: "wamid.success" }],
        }),
      ),
    });
    const sender = new MessageSenderService({
      client,
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    const { tracer, spanNames } = spyTracer();
    const useCase = new SendTextMessage(
      makeRegistry(),
      sender,
      events,
      "test-token",
      createMockLogger() as never,
      tracer,
    );

    const result = unwrap(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );

    expect(result.id.toString()).toBe("wamid.success");
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.payload).toEqual({
      messageId: "wamid.success",
      conversationId: result.conversationId.toString(),
      to: "+628123456789",
      from: PHONE_NUMBER_ID,
      branch: Branch.BINTARO,
      phoneNumberId: PHONE_NUMBER_ID,
      type: "TEXT",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      version: "1.0",
    });
    expect(spanNames).toEqual(["whatsapp-connector.send-text-message"]);
  });

  it("logs a warning and does NOT emit MessageSent when the send fails", async () => {
    const client = makeFakeClient({
      sendText: vi.fn(async () => err(new AuthError("bad token"))),
    });
    const sender = new MessageSenderService({
      client,
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const publisher = createFakePublisher();
    const events = new WhatsAppConnectorEvents(publisher);
    const logger = createMockLogger();
    const useCase = new SendTextMessage(
      makeRegistry(),
      sender,
      events,
      "test-token",
      logger as never,
      spyTracer().tracer,
    );

    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-2",
      }),
    );

    expect(error).toBeInstanceOf(AuthError);
    expect(publisher.published).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: "bad token" }),
      expect.stringContaining("send text message failed"),
    );
  });

  it("never calls the client when the branch is unregistered (fails fast before dispatch)", async () => {
    const sendText = vi.fn();
    const client = makeFakeClient({ sendText });
    const sender = new MessageSenderService({
      client,
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const publisher = createFakePublisher();
    const useCase = new SendTextMessage(
      new WabaRegistry(),
      sender,
      new WhatsAppConnectorEvents(publisher),
      "test-token",
      createMockLogger() as never,
      spyTracer().tracer,
    );

    await useCase.execute({
      branch: Branch.BINTARO,
      to: "08123456789",
      body: "Hai kak!",
      tenantId: "dss-motor",
      correlationId: "corr-3",
    });

    expect(sendText).not.toHaveBeenCalled();
  });

  it("never calls the client when the phone number cannot be normalized", async () => {
    const sendText = vi.fn();
    const client = makeFakeClient({ sendText });
    const sender = new MessageSenderService({
      client,
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const useCase = new SendTextMessage(
      makeRegistry(),
      sender,
      new WhatsAppConnectorEvents(createFakePublisher()),
      "test-token",
      createMockLogger() as never,
      spyTracer().tracer,
    );

    await useCase.execute({
      branch: Branch.BINTARO,
      to: "+1234567890",
      body: "Hai kak!",
      tenantId: "dss-motor",
      correlationId: "corr-4",
    });

    expect(sendText).not.toHaveBeenCalled();
  });
});
