import { err, ok } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { MessageSenderService } from "../../../src/application/services/MessageSenderService.js";
import type { Tracer } from "../../../src/application/tracer.js";
import { SendTemplateMessage } from "../../../src/application/use-cases/SendTemplateMessage.js";
import type { IWhatsAppClient } from "../../../src/contracts/IWhatsAppClient.js";
import { WabaAccount } from "../../../src/domain/entities/WabaAccount.js";
import { TemplateError } from "../../../src/domain/errors/index.js";
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

describe("SendTemplateMessage (unit, hand-rolled IWhatsAppClient double)", () => {
  it("emits MessageSent with type TEMPLATE and the default language 'id'", async () => {
    const client = makeFakeClient({
      sendTemplate: vi.fn(async () =>
        ok({
          messaging_product: "whatsapp" as const,
          contacts: [],
          messages: [{ id: "wamid.tpl" }],
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
    const { tracer, spanNames } = spyTracer();
    const useCase = new SendTemplateMessage(
      makeRegistry(),
      sender,
      new WhatsAppConnectorEvents(publisher),
      "test-token",
      createMockLogger() as never,
      tracer,
    );

    const result = unwrap(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        templateName: "hello_world",
        bodyParameters: ["Budi"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );

    expect(result.id.toString()).toBe("wamid.tpl");
    expect(publisher.published[0]?.payload).toMatchObject({
      messageId: "wamid.tpl",
      type: "TEMPLATE",
      branch: Branch.BINTARO,
      phoneNumberId: PHONE_NUMBER_ID,
    });
    expect(spanNames).toEqual(["whatsapp-connector.send-template-message"]);
  });

  it("respects an explicit languageCode passed through to the sendInput", async () => {
    let capturedLanguage = "";
    const client = makeFakeClient({
      sendTemplate: vi.fn(async (input) => {
        capturedLanguage = input.languageCode;
        return ok({
          messaging_product: "whatsapp" as const,
          contacts: [],
          messages: [{ id: "wamid.tpl2" }],
        });
      }),
    });
    const sender = new MessageSenderService({
      client,
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const useCase = new SendTemplateMessage(
      makeRegistry(),
      sender,
      new WhatsAppConnectorEvents(createFakePublisher()),
      "test-token",
      createMockLogger() as never,
      spyTracer().tracer,
    );

    await useCase.execute({
      branch: Branch.BINTARO,
      to: "08123456789",
      templateName: "hello_world",
      languageCode: "en_US",
      bodyParameters: [],
      tenantId: "dss-motor",
      correlationId: "corr-2",
    });

    expect(capturedLanguage).toBe("en_US");
  });

  it("logs a warning and does NOT emit MessageSent when the template is rejected", async () => {
    const client = makeFakeClient({
      sendTemplate: vi.fn(async () => err(new TemplateError("template not approved"))),
    });
    const sender = new MessageSenderService({
      client,
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const publisher = createFakePublisher();
    const logger = createMockLogger();
    const useCase = new SendTemplateMessage(
      makeRegistry(),
      sender,
      new WhatsAppConnectorEvents(publisher),
      "test-token",
      logger as never,
      spyTracer().tracer,
    );

    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        templateName: "hello_world",
        bodyParameters: [],
        tenantId: "dss-motor",
        correlationId: "corr-3",
      }),
    );

    expect(error).toBeInstanceOf(TemplateError);
    expect(publisher.published).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: "template not approved" }),
      expect.stringContaining("send template message failed"),
    );
  });

  it("rejects an empty templateName before ever calling the client", async () => {
    const sendTemplate = vi.fn();
    const client = makeFakeClient({ sendTemplate });
    const sender = new MessageSenderService({
      client,
      rateLimiters: new PhoneNumberRateLimiterRegistry(),
      retry: new ExponentialBackoffRetry({ sleep: async () => undefined }),
    });
    const useCase = new SendTemplateMessage(
      makeRegistry(),
      sender,
      new WhatsAppConnectorEvents(createFakePublisher()),
      "test-token",
      createMockLogger() as never,
      spyTracer().tracer,
    );

    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        templateName: "",
        bodyParameters: [],
        tenantId: "dss-motor",
        correlationId: "corr-4",
      }),
    );

    expect(error).toBeDefined();
    expect(sendTemplate).not.toHaveBeenCalled();
  });
});
