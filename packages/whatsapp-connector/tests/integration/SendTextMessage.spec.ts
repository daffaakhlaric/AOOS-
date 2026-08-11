import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MessageSenderService } from "../../src/application/services/MessageSenderService.js";
import { SendTextMessage } from "../../src/application/use-cases/SendTextMessage.js";
import { WabaAccount } from "../../src/domain/entities/WabaAccount.js";
import { AuthError, RateLimitError } from "../../src/domain/errors/index.js";
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

function makeUseCase(retryOptions: { maxAttempts?: number } = {}) {
  const client = new WhatsAppCloudApiClient();
  const rateLimiters = new PhoneNumberRateLimiterRegistry();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, ...retryOptions });
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
  const logger = createMockLogger();
  const useCase = new SendTextMessage(
    registry,
    sender,
    events,
    "test-token",
    logger as never,
    createFakeTracer(),
  );
  return { useCase, publisher };
}

describe("SendTextMessage (MSW-mocked WhatsApp Cloud API)", () => {
  it("success -> MessageSent event emitted, wamid returned", async () => {
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () =>
        HttpResponse.json(waSendMessageResponseJson("wamid.success")),
      ),
    );
    const { useCase, publisher } = makeUseCase();
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
    const sentEvents = publisher.published.filter((e) => e.type === "aaos.whatsapp.message.sent");
    expect(sentEvents).toHaveLength(1);
  });

  it("429 -> retry with backoff -> success on retry", async () => {
    let calls = 0;
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(waErrorResponseJson(4, "Rate limited"), {
            status: 429,
            headers: { "retry-after": "1" },
          });
        }
        return HttpResponse.json(waSendMessageResponseJson("wamid.retried"));
      }),
    );
    const { useCase } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-2",
      }),
    );
    expect(result.id.toString()).toBe("wamid.retried");
    expect(calls).toBe(2);
  });

  it("429 3x -> RateLimitError", async () => {
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () =>
        HttpResponse.json(waErrorResponseJson(4, "Rate limited"), { status: 429 }),
      ),
    );
    const { useCase } = makeUseCase({ maxAttempts: 3 });
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-3",
      }),
    );
    expect(error).toBeInstanceOf(RateLimitError);
  });

  it("401 -> AuthError, no retry", async () => {
    let calls = 0;
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () => {
        calls += 1;
        return HttpResponse.json(waErrorResponseJson(190, "Invalid token"), { status: 401 });
      }),
    );
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-4",
      }),
    );
    expect(error).toBeInstanceOf(AuthError);
    expect(calls).toBe(1);
  });

  it("rejects an unresolvable phone number before ever calling the API", async () => {
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "+1234567890",
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-5",
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
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-6",
      }),
    );
    expect(error.message).toContain("MULTI");
  });

  it("rejects a body exceeding 4096 characters before ever calling the API", async () => {
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "a".repeat(4097),
        tenantId: "dss-motor",
        correlationId: "corr-8",
      }),
    );
    expect(error).toBeDefined();
  });

  it("local rate-limit budget exhaustion short-circuits before calling the API", async () => {
    const client = new WhatsAppCloudApiClient();
    const rateLimiters = new PhoneNumberRateLimiterRegistry({ capacity: 0 });
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
    const useCase = new SendTextMessage(
      registry,
      sender,
      events,
      "test-token",
      createMockLogger() as never,
      createFakeTracer(),
    );
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "Hai kak!",
        tenantId: "dss-motor",
        correlationId: "corr-7",
      }),
    );
    expect(error).toBeInstanceOf(RateLimitError);
  });
});
