import { Branch } from "@aos/meta-ads-connector";
import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MessageSenderService } from "../../src/application/services/MessageSenderService.js";
import { SendInteractiveMessage } from "../../src/application/use-cases/SendInteractiveMessage.js";
import { WabaAccount } from "../../src/domain/entities/WabaAccount.js";
import { ApiServerError } from "../../src/domain/errors/index.js";
import { WhatsAppConnectorEvents } from "../../src/domain/events/WhatsAppConnectorEvents.js";
import { PhoneNumber } from "../../src/domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../../src/domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../../src/domain/value-objects/WabaId.js";
import { PhoneNumberRateLimiterRegistry } from "../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { WhatsAppCloudApiClient } from "../../src/infrastructure/whatsapp-api/WhatsAppCloudApiClient.js";
import { WabaRegistry } from "../../src/registry/WabaRegistry.js";
import { waSendMessageResponseJson } from "../fixtures/waFixtures.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";
import { createFakeTracer } from "../helpers/tracer.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";
const PHONE_NUMBER_ID = "100000000000001";

function makeUseCase(maxAttempts = 3) {
  const client = new WhatsAppCloudApiClient();
  const rateLimiters = new PhoneNumberRateLimiterRegistry();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts });
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
  const useCase = new SendInteractiveMessage(
    registry,
    sender,
    events,
    "test-token",
    createMockLogger() as never,
    createFakeTracer(),
  );
  return { useCase, publisher };
}

describe("SendInteractiveMessage (MSW-mocked WhatsApp Cloud API)", () => {
  it("success -> MessageSent event emitted, wamid returned", async () => {
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () =>
        HttpResponse.json(waSendMessageResponseJson("wamid.interactive1")),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "Mau lanjut diskusi soal Xpander?",
        buttons: [
          { id: "yes", title: "Ya, lanjut" },
          { id: "later", title: "Nanti dulu" },
        ],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(result.id.toString()).toBe("wamid.interactive1");
    expect(publisher.published).toHaveLength(1);
  });

  it("500 3x -> ApiServerError (server errors retry then exhaust)", async () => {
    mswServer.use(
      http.post(`${BASE}/${PHONE_NUMBER_ID}/messages`, () =>
        HttpResponse.json({ error: { message: "Internal error" } }, { status: 500 }),
      ),
    );
    const { useCase } = makeUseCase(3);
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "hi",
        buttons: [{ id: "yes", title: "Yes" }],
        tenantId: "dss-motor",
        correlationId: "corr-2",
      }),
    );
    expect(error).toBeInstanceOf(ApiServerError);
  });

  it("rejects an unresolvable phone number before ever calling the API", async () => {
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "+1234567890",
        body: "hi",
        buttons: [{ id: "yes", title: "Yes" }],
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
        body: "hi",
        buttons: [{ id: "yes", title: "Yes" }],
        tenantId: "dss-motor",
        correlationId: "corr-5",
      }),
    );
    expect(error.message).toContain("MULTI");
  });

  it("rejects too many buttons before calling the API", async () => {
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        branch: Branch.BINTARO,
        to: "08123456789",
        body: "hi",
        buttons: [
          { id: "1", title: "One" },
          { id: "2", title: "Two" },
          { id: "3", title: "Three" },
          { id: "4", title: "Four" },
        ],
        tenantId: "dss-motor",
        correlationId: "corr-3",
      }),
    );
    expect(error).toBeDefined();
  });
});
