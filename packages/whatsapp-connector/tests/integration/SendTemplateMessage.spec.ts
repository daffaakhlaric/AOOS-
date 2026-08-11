import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MessageSenderService } from "../../src/application/services/MessageSenderService.js";
import { SendTemplateMessage } from "../../src/application/use-cases/SendTemplateMessage.js";
import { WabaAccount } from "../../src/domain/entities/WabaAccount.js";
import { TemplateError } from "../../src/domain/errors/index.js";
import { WhatsAppConnectorEvents } from "../../src/domain/events/WhatsAppConnectorEvents.js";
import { PhoneNumber } from "../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../src/domain/value-objects/WabaId.js";
import { PhoneNumberRateLimiterRegistry } from "../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { WhatsAppCloudApiClient } from "../../src/infrastructure/whatsapp-api/WhatsAppCloudApiClient.js";
import { WabaRegistry } from "../../src/registry/WabaRegistry.js";
import { waErrorResponseJson, waSendMessageResponseJson } from "../fixtures/waFixtures.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";
import { createFakeTracer } from "../helpers/tracer.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";
const PHONE_NUMBER_ID = "100000000000001";

function makeUseCase() {
  const client = new WhatsAppCloudApiClient();
  const rateLimiters = new PhoneNumberRateLimiterRegistry();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
  const sender = new MessageSenderService({ client, rateLimiters, retry });
  const publisher = createFakePublisher();
  const events = new WhatsAppConnectorEvents(publisher);
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
  const useCase = new SendTemplateMessage(
    registry,
    sender,
    events,
    "test-token",
    createMockLogger() as never,
    createFakeTracer(),
  );
  return { useCase, publisher };
}

describe("SendTemplateMessage (MSW-mocked WhatsApp Cloud API)", () => {
  it("success -> MessageSent event emitted, wamid returned", async () => {
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () =>
        HttpResponse.json(waSendMessageResponseJson("wamid.template1")),
      ),
    );
    const { useCase, publisher } = makeUseCase();
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
    expect(result.id.toString()).toBe("wamid.template1");
    expect(publisher.published).toHaveLength(1);
  });

  it("template not approved -> TemplateError", async () => {
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () =>
        HttpResponse.json(waErrorResponseJson(132000, "Template not approved"), { status: 400 }),
      ),
    );
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        templateName: "not_approved",
        bodyParameters: [],
        tenantId: "dss-motor",
        correlationId: "corr-2",
      }),
    );
    expect(error).toBeInstanceOf(TemplateError);
  });

  it("rejects an unresolvable phone number before ever calling the API", async () => {
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "+1234567890",
        templateName: "hello_world",
        bodyParameters: [],
        tenantId: "dss-motor",
        correlationId: "corr-4",
      }),
    );
    expect(error).toBeDefined();
  });

  it("rejects an unregistered branch", async () => {
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.MULTI,
        to: "08123456789",
        templateName: "hello_world",
        bodyParameters: [],
        tenantId: "dss-motor",
        correlationId: "corr-5",
      }),
    );
    expect(error.message).toContain("MULTI");
  });

  it("rejects an empty templateName before calling the API", async () => {
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        templateName: "",
        bodyParameters: [],
        tenantId: "dss-motor",
        correlationId: "corr-3",
      }),
    );
    expect(error).toBeDefined();
  });
});
