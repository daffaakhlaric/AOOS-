import { err, ok } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import type { RawLeadData } from "../../../src/contracts/ILeadWebhookParser.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { AdId } from "../../../src/domain/value-objects/AdId.js";
import { AdSetId } from "../../../src/domain/value-objects/AdSetId.js";
import { CampaignId } from "../../../src/domain/value-objects/CampaignId.js";
import { LeadType } from "../../../src/domain/value-objects/LeadType.js";
import { PublisherPlatform } from "../../../src/domain/value-objects/PublisherPlatform.js";
import type { AdIdentifiers, AdResolver } from "../../../src/mappers/LeadMapper.js";
import { derivePublisherPlatform, mapLead, mapLeads } from "../../../src/mappers/LeadMapper.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const identifiers: AdIdentifiers = {
  adId: AdId.generate(),
  adSetId: AdSetId.generate(),
  campaignId: CampaignId.generate(),
  adAccountId: unwrap(AdAccountId.create("act_752604553578354")),
};

const resolveOk: AdResolver = () => ok(identifiers);
const resolveErr: AdResolver = () => err(new ValidationError("no such ad"));

function ctwaRaw(overrides: Partial<RawLeadData> = {}): RawLeadData {
  return {
    change: {
      field: "ctwa_message",
      value: { ad_id: "meta-ad-1", waba_id: "waba-1", phone_number: "+6281234567890" },
    },
    publisherObject: "page",
    receivedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function formRaw(overrides: Partial<RawLeadData> = {}): RawLeadData {
  return {
    change: {
      field: "leadgen",
      value: {
        ad_id: "meta-ad-1",
        form_id: "form-1",
        leadgen_id: "leadgen-1",
        created_time: 1700000000,
      },
    },
    publisherObject: "page",
    receivedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("derivePublisherPlatform", () => {
  it("maps 'instagram' to INSTAGRAM", () => {
    expect(derivePublisherPlatform("instagram")).toBe(PublisherPlatform.INSTAGRAM);
  });

  it("maps 'threads' to THREADS", () => {
    expect(derivePublisherPlatform("threads")).toBe(PublisherPlatform.THREADS);
  });

  it("defaults everything else (including 'page' and 'whatsapp_business_account') to FACEBOOK", () => {
    expect(derivePublisherPlatform("page")).toBe(PublisherPlatform.FACEBOOK);
    expect(derivePublisherPlatform("whatsapp_business_account")).toBe(PublisherPlatform.FACEBOOK);
  });
});

describe("mapLead", () => {
  it("maps a CTWA change into a CTWA Lead", () => {
    const lead = unwrap(mapLead(ctwaRaw(), resolveOk));
    expect(lead.type).toBe(LeadType.CTWA);
    expect(lead.phone).toBe("+6281234567890");
    expect(lead.wabaId).toBe("waba-1");
    expect(lead.adId.equals(identifiers.adId)).toBe(true);
  });

  it("maps a leadgen change into a FORM Lead, carrying leadgen_id/form_id as formFields", () => {
    const lead = unwrap(mapLead(formRaw(), resolveOk));
    expect(lead.type).toBe(LeadType.FORM);
    expect(lead.formFields).toEqual({ leadgen_id: "leadgen-1", form_id: "form-1" });
  });

  it("includes page_id in formFields when present", () => {
    const lead = unwrap(
      mapLead(
        formRaw({
          change: {
            field: "leadgen",
            value: {
              ad_id: "meta-ad-1",
              form_id: "form-1",
              leadgen_id: "leadgen-1",
              created_time: 1,
              page_id: "pg-1",
            },
          },
        }),
        resolveOk,
      ),
    );
    expect(lead.formFields?.page_id).toBe("pg-1");
  });

  it("propagates an ad-resolution failure", () => {
    expect(unwrapErr(mapLead(ctwaRaw(), resolveErr)).message).toMatch(/no such ad/);
  });

  it("derives source from the publisherObject", () => {
    const lead = unwrap(mapLead(ctwaRaw({ publisherObject: "instagram" }), resolveOk));
    expect(lead.source).toBe(PublisherPlatform.INSTAGRAM);
  });
});

describe("mapLeads", () => {
  it("maps a batch of mixed CTWA and FORM leads", () => {
    const leads = unwrap(mapLeads([ctwaRaw(), formRaw()], resolveOk));
    expect(leads.map((l) => l.type)).toEqual([LeadType.CTWA, LeadType.FORM]);
  });

  it("returns an empty array for an empty batch (webhook with 0 leads edge case)", () => {
    expect(unwrap(mapLeads([], resolveOk))).toEqual([]);
  });

  it("fails fast on the first mapping error in a batch", () => {
    expect(unwrapErr(mapLeads([ctwaRaw(), formRaw()], resolveErr)).message).toMatch(/no such ad/);
  });
});
