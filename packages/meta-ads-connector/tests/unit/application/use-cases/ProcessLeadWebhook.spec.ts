import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { ProcessLeadWebhook } from "../../../../src/application/use-cases/ProcessLeadWebhook.js";
import type { ILeadWebhookParser } from "../../../../src/contracts/ILeadWebhookParser.js";
import { PayloadParseError } from "../../../../src/domain/errors/index.js";
import { MetaAdsConnectorEvents } from "../../../../src/domain/events/MetaAdsConnectorEvents.js";
import { WebhookVerifier } from "../../../../src/infrastructure/webhook/WebhookVerifier.js";
import type { AdResolver } from "../../../../src/mappers/LeadMapper.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function makeUseCase(parser: ILeadWebhookParser, resolveAd: AdResolver) {
  const verifier = new WebhookVerifier();
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const useCase = new ProcessLeadWebhook(
    verifier,
    parser,
    resolveAd,
    events,
    createMockLogger() as never,
    createFakeTracer(),
  );
  return { useCase, publisher };
}

describe("ProcessLeadWebhook (unit, fake parser — signature verified against real HMAC)", () => {
  it("propagates a parser failure without publishing any events", async () => {
    const parser: ILeadWebhookParser = {
      parse: vi.fn().mockReturnValue(err(new PayloadParseError("bad shape"))),
    };
    const { useCase, publisher } = makeUseCase(parser, () => ok({} as never));

    const { createHmac } = await import("node:crypto");
    const body = "{}";
    const signature = `sha256=${createHmac("sha256", "secret").update(body, "utf8").digest("hex")}`;

    const result = await useCase.execute({
      rawBody: body,
      signature,
      webhookAppSecret: "secret",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });

  it("logs a warning and returns err on signature verification failure before ever calling the parser", async () => {
    const parser: ILeadWebhookParser = { parse: vi.fn() };
    const { useCase, publisher } = makeUseCase(parser, () => ok({} as never));
    const result = await useCase.execute({
      rawBody: "{}",
      signature: undefined,
      webhookAppSecret: "secret",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(parser.parse).not.toHaveBeenCalled();
    expect(publisher.published).toHaveLength(0);
  });
});
