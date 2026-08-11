import { describe, expect, it } from "vitest";

import { LeadBuilder } from "../../../../src/builders/LeadBuilder.js";
import { LeadType } from "../../../../src/domain/value-objects/LeadType.js";
import { PublisherPlatform } from "../../../../src/domain/value-objects/PublisherPlatform.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("Lead", () => {
  it("constructs a valid CTWA Lead (builder default)", () => {
    const lead = unwrap(new LeadBuilder().build());
    expect(lead.type).toBe(LeadType.CTWA);
    expect(lead.phone).toBe("+6281234567890");
  });

  it("constructs a valid FORM Lead", () => {
    const lead = unwrap(
      new LeadBuilder()
        .withType(LeadType.FORM)
        .withFormFields({ full_name: "Budi", city: "Cinere" })
        .withPhone(undefined)
        .withWabaId(undefined)
        .build(),
    );
    expect(lead.type).toBe(LeadType.FORM);
    expect(lead.formFields).toEqual({ full_name: "Budi", city: "Cinere" });
    expect(lead.wabaId).toBeUndefined();
  });

  it("rejects an invalid type", () => {
    expect(unwrapErr(new LeadBuilder().withType("BOGUS" as LeadType).build()).message).toMatch(
      /type/,
    );
  });

  it("rejects an invalid source", () => {
    expect(
      unwrapErr(new LeadBuilder().withSource("bogus" as PublisherPlatform).build()).message,
    ).toMatch(/source/);
  });

  it("rejects a CTWA lead with no phone", () => {
    expect(unwrapErr(new LeadBuilder().withPhone(undefined).build()).message).toMatch(/phone/);
  });

  it("rejects a CTWA lead with an empty-string phone", () => {
    expect(new LeadBuilder().withPhone("").build().ok).toBe(false);
  });

  it("rejects a FORM lead with no formFields", () => {
    expect(
      unwrapErr(new LeadBuilder().withType(LeadType.FORM).withFormFields(undefined).build())
        .message,
    ).toMatch(/formFields/);
  });

  it("rejects a FORM lead with empty formFields", () => {
    expect(new LeadBuilder().withType(LeadType.FORM).withFormFields({}).build().ok).toBe(false);
  });

  it("defensively copies formFields on construction", () => {
    const fields: Record<string, string> = { a: "1" };
    const lead = unwrap(new LeadBuilder().withType(LeadType.FORM).withFormFields(fields).build());
    fields.b = "2";
    expect(lead.formFields).toEqual({ a: "1" });
  });

  it("exposes every documented getter", () => {
    const lead = unwrap(new LeadBuilder().build());
    expect(lead.id).toBeDefined();
    expect(lead.adId).toBeDefined();
    expect(lead.adSetId).toBeDefined();
    expect(lead.campaignId).toBeDefined();
    expect(lead.adAccountId).toBeDefined();
    expect(lead.source).toBe(PublisherPlatform.FACEBOOK);
    expect(lead.receivedAt).toBeInstanceOf(Date);
  });
});
