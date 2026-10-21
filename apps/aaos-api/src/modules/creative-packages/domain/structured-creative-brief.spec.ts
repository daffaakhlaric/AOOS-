import { describe, expect, it } from "vitest";

import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";
import { SaveCampaignDraftSchema } from "../dto/campaign-draft.dto.js";

import { buildListingCreativeBrief } from "./listing-creative-brief.js";
import { validateCreativeBrief } from "./structured-creative-brief.js";

const id = "6cb4339b-9c5e-4160-b35d-7f54b48b53b0";
const listing: ListingResponseDto = {
  id,
  title: "Rumah BSD",
  propertyType: "RUMAH",
  listingStatus: "ACTIVE",
  price: 3_700_000_000,
  city: "Tangerang Selatan",
  landArea: 120,
  buildArea: 150,
  certificate: "SHM",
  photos: [],
  documents: [],
  highlights: [],
  inKnowledgeBase: false,
  createdAt: "2026-10-02T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};
const draft = SaveCampaignDraftSchema.parse({
  id,
  listingId: id,
  name: "BSD",
  goal: "Qualified Leads",
  dailyBudget: 300000,
  start: "2026-10-03",
  end: "2026-10-10",
  copyIndex: 0,
  metaDestination: { pageId: "1234", adAccountId: "act_1234", number: "+6281234567890" },
});

describe("structured Samantha handoff", () => {
  it("hydrates a complete, explicitly rule-based brief with listing provenance", () => {
    const result = buildListingCreativeBrief("property-tenant", id, draft, listing);
    expect(result.status).toBe("READY");
    if (result.status !== "READY") throw new Error("Expected valid brief");
    expect(result.brief.CTA.destination).toBe("6281234567890");
    expect(result.brief.formats.reduce((n, f) => n + f.quantity, 0)).toBe(
      result.brief.conceptCount,
    );
    expect(
      result.brief.factualClaims.find((c) => c.sourceLocator.startsWith("listing.price"))?.text,
    ).toContain("3.700.000.000");
    expect(result.brief.offer.promo).toBeUndefined();
    expect(result.brief.offer.verifiedClaims).toEqual([]);
    expect(result.brief.strategyMethod).toBe("LISTING_RULES");
    expect(result.brief.targetAudience.validationStatus).toBe("DRAFT_NOT_META_VALIDATED");
  });
  it("returns exact missing fields for a missing destination and location", () => {
    const result = buildListingCreativeBrief(
      "property-tenant",
      id,
      { ...draft, metaDestination: null },
      { ...listing, city: "" },
    );
    expect(result.status).toBe("NEEDS_INPUT");
    expect(result.missingFields).toContain("CTA.destination");
    expect(result.missingFields).toContain("targetAudience.geo");
  });
  it("does not substitute a Page id for a lead form id", () => {
    const result = buildListingCreativeBrief(
      "property-tenant",
      id,
      { ...draft, goal: "Meta Lead Form" },
      listing,
    );
    expect(result.status).toBe("NEEDS_INPUT");
    expect(result.missingFields).toContain("CTA.destination");
  });
  it("rejects cross-listing claims, duplicated formats and incorrect output counts", () => {
    const result = buildListingCreativeBrief("property-tenant", id, draft, listing);
    if (result.status !== "READY") throw new Error("Expected valid brief");
    const broken = {
      ...result.brief,
      conceptCount: 1,
      formats: [result.brief.formats[0], result.brief.formats[0]],
      factualClaims: [
        {
          text: "Fasilitas",
          sourceId: "other-listing",
          sourceLocator: "listing.title",
          sourceType: "LISTING",
        },
      ],
    };
    expect(validateCreativeBrief(broken)).toMatchObject({
      status: "NEEDS_INPUT",
      missingFields: expect.arrayContaining([
        "formats",
        "conceptCount",
        "factualClaims.0.sourceId",
      ]),
    });
  });
  it("rejects impossible dates and does not accept client-owned links or tenant", () => {
    expect(SaveCampaignDraftSchema.safeParse({ ...draft, start: "2026-02-30" }).success).toBe(
      false,
    );
    const clean = SaveCampaignDraftSchema.parse({
      ...draft,
      tenantId: "other",
      kaiProjectId: id,
      shortlistedCreativeIds: [id],
    });
    expect(clean).not.toHaveProperty("tenantId");
    expect(clean).not.toHaveProperty("shortlistedCreativeIds");
  });
  it("blocks an unsourced promo from entering the brief", () => {
    const result = buildListingCreativeBrief("property-tenant", id, draft, listing);
    if (result.status !== "READY") throw new Error("Expected valid brief");
    expect(
      validateCreativeBrief({ ...result.brief, offer: { ...result.brief.offer, promo: "DP 10%" } }),
    ).toMatchObject({ status: "NEEDS_INPUT", missingFields: ["offer.promo"] });
  });
});
