import { describe, expect, it } from "vitest";

import { LeadBuilder } from "../../../src/builders/LeadBuilder.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { AdId } from "../../../src/domain/value-objects/AdId.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { LeadType } from "../../../src/domain/value-objects/LeadType.js";
import { PublisherPlatform } from "../../../src/domain/value-objects/PublisherPlatform.js";
import { unwrap } from "../../helpers/result.js";

describe("LeadBuilder", () => {
  it("builds a valid CTWA Lead by default", () => {
    const lead = unwrap(new LeadBuilder().build());
    expect(lead.type).toBe(LeadType.CTWA);
    expect(lead.phone).toBeDefined();
  });

  it("every with* method overrides the corresponding field and is chainable", () => {
    const id = LeadId.generate();
    const adId = AdId.generate();
    const adSetId = AdSetId.generate();
    const campaignId = CampaignId.generate();
    const adAccountId = unwrap(AdAccountId.create("act_999999999999999"));
    const lead = unwrap(
      new LeadBuilder()
        .withId(id)
        .withAdId(adId)
        .withAdSetId(adSetId)
        .withCampaignId(campaignId)
        .withAdAccountId(adAccountId)
        .withType(LeadType.FORM)
        .withWabaId(undefined)
        .withPhone(undefined)
        .withFormFields({ q1: "a1" })
        .withSource(PublisherPlatform.INSTAGRAM)
        .withReceivedAt(new Date("2025-03-03T00:00:00.000Z"))
        .build(),
    );
    expect(lead.id.equals(id)).toBe(true);
    expect(lead.adId.equals(adId)).toBe(true);
    expect(lead.adSetId.equals(adSetId)).toBe(true);
    expect(lead.campaignId.equals(campaignId)).toBe(true);
    expect(lead.adAccountId.equals(adAccountId)).toBe(true);
    expect(lead.type).toBe(LeadType.FORM);
    expect(lead.formFields).toEqual({ q1: "a1" });
    expect(lead.source).toBe(PublisherPlatform.INSTAGRAM);
    expect(lead.receivedAt.toISOString()).toBe("2025-03-03T00:00:00.000Z");
  });

  it("propagates a validation failure through build()", () => {
    expect(new LeadBuilder().withPhone(undefined).build().ok).toBe(false);
  });
});
