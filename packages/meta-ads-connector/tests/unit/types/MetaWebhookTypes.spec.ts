import { describe, expect, it } from "vitest";

import {
  MetaCtwaChangeValueSchema,
  MetaFormLeadChangeValueSchema,
  MetaWebhookChangeSchema,
  MetaWebhookEntrySchema,
  MetaWebhookPayloadSchema,
} from "../../../src/types/MetaWebhookTypes.js";

describe("MetaFormLeadChangeValueSchema", () => {
  it("accepts a well-formed leadgen value", () => {
    expect(
      MetaFormLeadChangeValueSchema.safeParse({
        ad_id: "a1",
        form_id: "f1",
        leadgen_id: "l1",
        created_time: 1,
      }).success,
    ).toBe(true);
  });

  it("allows page_id to be omitted", () => {
    expect(
      MetaFormLeadChangeValueSchema.safeParse({
        ad_id: "a1",
        form_id: "f1",
        leadgen_id: "l1",
        created_time: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects a missing leadgen_id", () => {
    expect(
      MetaFormLeadChangeValueSchema.safeParse({ ad_id: "a1", form_id: "f1", created_time: 1 })
        .success,
    ).toBe(false);
  });
});

describe("MetaCtwaChangeValueSchema", () => {
  it("accepts a well-formed CTWA value", () => {
    expect(
      MetaCtwaChangeValueSchema.safeParse({ ad_id: "a1", waba_id: "w1", phone_number: "+1" })
        .success,
    ).toBe(true);
  });

  it("allows ctwa_clid and timestamp to be omitted", () => {
    expect(
      MetaCtwaChangeValueSchema.safeParse({ ad_id: "a1", waba_id: "w1", phone_number: "+1" })
        .success,
    ).toBe(true);
  });

  it("rejects a missing phone_number", () => {
    expect(MetaCtwaChangeValueSchema.safeParse({ ad_id: "a1", waba_id: "w1" }).success).toBe(false);
  });
});

describe("MetaWebhookChangeSchema (discriminated union on `field`)", () => {
  it("discriminates 'leadgen' into the Form shape", () => {
    const result = MetaWebhookChangeSchema.safeParse({
      field: "leadgen",
      value: { ad_id: "a1", form_id: "f1", leadgen_id: "l1", created_time: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("discriminates 'ctwa_message' into the CTWA shape", () => {
    const result = MetaWebhookChangeSchema.safeParse({
      field: "ctwa_message",
      value: { ad_id: "a1", waba_id: "w1", phone_number: "+1" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized field discriminator", () => {
    expect(MetaWebhookChangeSchema.safeParse({ field: "messages", value: {} }).success).toBe(false);
  });

  it("rejects a 'leadgen' field with a CTWA-shaped value", () => {
    expect(
      MetaWebhookChangeSchema.safeParse({
        field: "leadgen",
        value: { ad_id: "a1", waba_id: "w1", phone_number: "+1" },
      }).success,
    ).toBe(false);
  });
});

describe("MetaWebhookEntrySchema", () => {
  it("accepts an entry with no changes field (0-lead edge case)", () => {
    expect(MetaWebhookEntrySchema.safeParse({ id: "e1" }).success).toBe(true);
  });

  it("accepts an entry with an empty changes array", () => {
    expect(MetaWebhookEntrySchema.safeParse({ id: "e1", changes: [] }).success).toBe(true);
  });

  it("rejects an entry missing id", () => {
    expect(MetaWebhookEntrySchema.safeParse({}).success).toBe(false);
  });
});

describe("MetaWebhookPayloadSchema", () => {
  it("accepts a payload with 0 entries", () => {
    expect(MetaWebhookPayloadSchema.safeParse({ object: "page", entry: [] }).success).toBe(true);
  });

  it("rejects a payload missing 'object'", () => {
    expect(MetaWebhookPayloadSchema.safeParse({ entry: [] }).success).toBe(false);
  });

  it("rejects a payload missing 'entry'", () => {
    expect(MetaWebhookPayloadSchema.safeParse({ object: "page" }).success).toBe(false);
  });
});
