import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { GetInstagramMediaInsights } from "../../../src/application/use-cases/GetInstagramMediaInsights.js";
import { GetPagePostInsights } from "../../../src/application/use-cases/GetPagePostInsights.js";
import { PublishFacebookPost } from "../../../src/application/use-cases/PublishFacebookPost.js";
import { PublishInstagramMedia } from "../../../src/application/use-cases/PublishInstagramMedia.js";
import { MetaOrganicConnectorFactory } from "../../../src/factories/MetaOrganicConnectorFactory.js";
import { MetaGraphApiClient } from "../../../src/infrastructure/meta-api/MetaGraphApiClient.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { createFakeTracer } from "../../helpers/tracer.js";

describe("MetaOrganicConnectorFactory", () => {
  it("creates a fully-wired connector with every use case and the raw client", () => {
    const connector = MetaOrganicConnectorFactory.create({
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });

    expect(connector.publishFacebookPost).toBeInstanceOf(PublishFacebookPost);
    expect(connector.publishInstagramMedia).toBeInstanceOf(PublishInstagramMedia);
    expect(connector.getPagePostInsights).toBeInstanceOf(GetPagePostInsights);
    expect(connector.getInstagramMediaInsights).toBeInstanceOf(GetInstagramMediaInsights);
    expect(connector.rateLimiter).toBeInstanceOf(TokenBucketRateLimiter);
    expect(connector.client).toBeInstanceOf(MetaGraphApiClient);
  });

  it("uses default logger/tracer when none are supplied", () => {
    const connector = MetaOrganicConnectorFactory.create();
    expect(connector.publishFacebookPost).toBeInstanceOf(PublishFacebookPost);
  });

  it("forwards rateLimitPerHour/retry/timeout/fetchImpl options through to the composed pieces", () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ id: "x" }));
    const connector = MetaOrganicConnectorFactory.create({
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
      rateLimitPerHour: 5,
      retryMaxAttempts: 1,
      retryBaseDelayMs: 10,
      timeoutMs: 1000,
      fetchImpl,
    });
    expect(connector.rateLimiter.getRateLimitStatus().remaining).toBe(5);
  });
});
