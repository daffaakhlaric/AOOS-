import { err } from "@aos/common";
import {
  AdBuilder,
  AdSetBuilder,
  Branch,
  Verdict,
  type Ad,
  type AdAccount,
} from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { GenerateCreativeBrief } from "../../../../src/application/use-cases/GenerateCreativeBrief.js";
import { CreativeBriefBuilder } from "../../../../src/builders/CreativeBriefBuilder.js";
import { DecisionError } from "../../../../src/domain/errors/index.js";
import { MetaAdsAgentEvents } from "../../../../src/domain/events/MetaAdsAgentEvents.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

function account(ad: Ad): AdAccount {
  const adSet = unwrap(new AdSetBuilder().withAds([ad]).build());
  return {
    id: ad.adAccountId,
    campaigns: [{ adSets: [adSet] }],
  } as unknown as AdAccount;
}

describe("GenerateCreativeBrief", () => {
  it("generates a CreativeBrief and publishes CreativeBriefGenerated", async () => {
    const ad = unwrap(
      new AdBuilder()
        .withName("Xpander Cross 2019")
        .withBranch(Branch.BINTARO)
        .withVerdict(Verdict.REFRESH)
        .build(),
    );
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const useCase = new GenerateCreativeBrief(
      new CreativeBriefBuilder(() => new Date("2026-08-09T00:00:00.000Z")),
      events,
    );

    const result = await useCase.execute({
      ad,
      adAccount: account(ad),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.samantha.creative.briefed")).toBe(true);
  });

  it("propagates a generator failure and does not publish an event", async () => {
    const ad = unwrap(
      new AdBuilder()
        .withName("Xpander Cross 2019")
        .withBranch(Branch.BINTARO)
        .withVerdict(Verdict.REFRESH)
        .build(),
    );
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const useCase = new GenerateCreativeBrief(
      { generate: () => err(new DecisionError("boom")) },
      events,
    );

    const result = await useCase.execute({
      ad,
      adAccount: account(ad),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });
});
