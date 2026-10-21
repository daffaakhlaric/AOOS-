import { describe, expect, it, vi } from "vitest";

import type { ListingsService } from "../listings/listings.service.js";
import type { MetaLeadDestinationsService } from "../listings/meta-lead-destinations.service.js";

import { CreativeHandoffService } from "./creative-handoff.service.js";
import { SaveCampaignDraftSchema } from "./dto/campaign-draft.dto.js";
import type { CreativeHandoffRepository } from "./infrastructure/creative-handoff.repository.js";

const id = "6cb4339b-9c5e-4160-b35d-7f54b48b53b0";
const input = SaveCampaignDraftSchema.parse({
  id,
  listingId: id,
  name: "Test",
  goal: "WhatsApp Leads",
  dailyBudget: 1,
  start: "2026-10-03",
  end: "2026-10-04",
  copyIndex: 0,
  metaDestination: { pageId: "12", adAccountId: "act_34", number: "628123456789" },
});
function setup() {
  const repository = {
    save: vi.fn().mockImplementation(async (_tenant, draft, brief, _hash, missing) => ({
      draft: {
        data: draft,
        revision: 1,
        status: brief ? "READY" : "NEEDS_INPUT",
        missing_fields: missing,
        updated_at: "now",
      },
      project: brief ? { id: "project", creative_brief_id: brief.briefId } : null,
    })),
  };
  const listings = {
    getById: vi.fn().mockResolvedValue({
      id,
      title: "Listing",
      price: 1e9,
      city: "BSD",
      updatedAt: "2026-10-02",
      photos: [],
    }),
  };
  const destinations = {
    list: vi.fn().mockResolvedValue({
      adAccountId: "act_34",
      pages: [{ id: "12" }],
      whatsappNumbers: [{ displayNumber: "+62 8123456789" }],
    }),
  };
  const service = new CreativeHandoffService(
    repository as unknown as CreativeHandoffRepository,
    listings as unknown as ListingsService,
    destinations as unknown as MetaLeadDestinationsService,
  );
  return { service, repository, listings, destinations };
}

describe("campaign creative handoff authorization", () => {
  it("checks listing and destination with the same tenant before its atomic save", async () => {
    const { service, repository, listings, destinations } = setup();
    const result = await service.save("tenant-a", input);
    expect(listings.getById).toHaveBeenCalledWith("tenant-a", id);
    expect(destinations.list).toHaveBeenCalledWith("tenant-a");
    expect(repository.save.mock.calls[0]?.[0]).toBe("tenant-a");
    expect(result.kaiProjectId).toBe("project");
    expect(result).not.toHaveProperty("tenantId");
  });
  it("never writes a foreign listing or invalid Meta asset", async () => {
    const { service, repository, listings } = setup();
    listings.getById.mockRejectedValueOnce(new Error("Not found"));
    await expect(service.save("tenant-b", input)).rejects.toThrow("Not found");
    expect(repository.save).not.toHaveBeenCalled();
    await expect(
      service.save("tenant-a", {
        ...input,
        metaDestination: { ...input.metaDestination!, pageId: "99" },
      }),
    ).rejects.toThrow("Destination Meta");
    expect(repository.save).not.toHaveBeenCalled();
  });
  it("persists NEEDS_INPUT without a partial brief when the destination is missing", async () => {
    const { service, repository } = setup();
    const result = await service.save("tenant-a", { ...input, metaDestination: null });
    expect(result).toMatchObject({
      status: "NEEDS_INPUT",
      kaiProjectId: null,
      missingFields: ["CTA.destination"],
    });
    expect(repository.save.mock.calls[0]?.[2]).toBeNull();
  });
  it("uses a stable content hash for retries despite freshly proposed brief IDs", async () => {
    const { service, repository } = setup();
    await service.save("tenant-a", input);
    await service.save("tenant-a", input);
    expect(repository.save.mock.calls[0]?.[3]).toBe(repository.save.mock.calls[1]?.[3]);
    expect(repository.save.mock.calls[0]?.[2].briefId).not.toBe(
      repository.save.mock.calls[1]?.[2].briefId,
    );
  });
});
