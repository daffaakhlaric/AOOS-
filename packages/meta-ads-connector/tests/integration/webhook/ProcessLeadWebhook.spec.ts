import { createHmac } from "node:crypto";

import { ok, err } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { ProcessLeadWebhook } from "../../../src/application/use-cases/ProcessLeadWebhook.js";
import { MetaAdsConnectorEvents } from "../../../src/domain/events/MetaAdsConnectorEvents.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { AdId } from "../../../src/domain/value-objects/AdId.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { LeadType } from "../../../src/domain/value-objects/LeadType.js";
import { WebhookParser } from "../../../src/infrastructure/webhook/WebhookParser.js";
import { WebhookVerifier } from "../../../src/infrastructure/webhook/WebhookVerifier.js";
import type { AdIdentifiers, AdResolver } from "../../../src/mappers/LeadMapper.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

const APP_SECRET = "app-secret";
const identifiers: AdIdentifiers = {
  adId: AdId.generate(),
  adSetId: AdSetId.generate(),
  campaignId: CampaignId.generate(),
  adAccountId: unwrap(AdAccountId.create("act_752604553578354")),
};
const resolveOk: AdResolver = () => ok(identifiers);

function sign(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex")}`;
}

function makeUseCase(resolveAd: AdResolver = resolveOk) {
  const verifier = new WebhookVerifier();
  const parser = new WebhookParser({ now: () => new Date("2026-02-15T00:00:00.000Z") });
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const logger = createMockLogger();
  const useCase = new ProcessLeadWebhook(
    verifier,
    parser,
    resolveAd,
    events,
    logger as never,
    createFakeTracer(),
  );
  return { useCase, publisher };
}

describe("ProcessLeadWebhook (full flow, real HMAC + real WebhookParser)", () => {
  it("processes a CTWA lead end-to-end, returning the Lead and publishing LeadReceived", async () => {
    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "ctwa_message",
              value: { ad_id: "meta-ad-1", waba_id: "waba-1", phone_number: "+6281234567890" },
            },
          ],
        },
      ],
    });
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        rawBody: body,
        signature: sign(body),
        webhookAppSecret: APP_SECRET,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe(LeadType.CTWA);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.meta.lead.received");
  });

  it("processes a Form lead end-to-end, returning the Lead and publishing LeadReceived", async () => {
    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "leadgen",
              value: {
                ad_id: "meta-ad-1",
                form_id: "f1",
                leadgen_id: "l1",
                created_time: 1700000000,
              },
            },
          ],
        },
      ],
    });
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        rawBody: body,
        signature: sign(body),
        webhookAppSecret: APP_SECRET,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe(LeadType.FORM);
    expect(publisher.published[0]?.type).toBe("aaos.meta.lead.received");
  });

  it("rejects an invalid signature end-to-end, publishing no LeadReceived event", async () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      rawBody: body,
      signature: "sha256=" + "0".repeat(64),
      webhookAppSecret: APP_SECRET,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });

  it("rejects a missing signature end-to-end", async () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      rawBody: body,
      signature: undefined,
      webhookAppSecret: APP_SECRET,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });

  it("returns an empty leads array for a payload with 0 leads, publishing no events", async () => {
    const body = JSON.stringify({ object: "page", entry: [{ id: "e1", changes: [] }] });
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        rawBody: body,
        signature: sign(body),
        webhookAppSecret: APP_SECRET,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result).toEqual([]);
    expect(publisher.published).toHaveLength(0);
  });

  it("rejects a malformed (non-JSON) body end-to-end", async () => {
    const body = "{not json";
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      rawBody: body,
      signature: sign(body),
      webhookAppSecret: APP_SECRET,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
  });

  it("processes multiple leads across multiple entries, publishing one LeadReceived per lead", async () => {
    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "e1",
          changes: [
            { field: "ctwa_message", value: { ad_id: "a1", waba_id: "w1", phone_number: "+1" } },
          ],
        },
        {
          id: "e2",
          changes: [
            { field: "ctwa_message", value: { ad_id: "a2", waba_id: "w2", phone_number: "+2" } },
          ],
        },
      ],
    });
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        rawBody: body,
        signature: sign(body),
        webhookAppSecret: APP_SECRET,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result).toHaveLength(2);
    expect(publisher.published).toHaveLength(2);
  });

  it("propagates an ad-resolution failure (unsynced ad) as a Result.err, publishing no events", async () => {
    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "ctwa_message",
              value: { ad_id: "unknown-ad", waba_id: "w1", phone_number: "+1" },
            },
          ],
        },
      ],
    });
    const { useCase, publisher } = makeUseCase(() => err(new ValidationError("no such ad")));
    const result = await useCase.execute({
      rawBody: body,
      signature: sign(body),
      webhookAppSecret: APP_SECRET,
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });
});
