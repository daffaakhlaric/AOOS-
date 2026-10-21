import { expect, it } from "vitest";
import { mapListingDetail, mapListingKnowledge, parseDetailTab } from "@/lib/listing-detail";
import { listingFixture } from "./listing-fixture";
it("does not invent house facts for land, price or primary images", () => {
  const input = { ...listingFixture("a", "Tanah"), campaigns: [], errors: [] };
  input.listing.propertyType = "TANAH";
  input.listing.price = 0;
  input.listing.bedrooms = 4;
  const mapped = mapListingDetail(input);
  expect(mapped.facts.find((f) => f.label === "Kamar tidur")).toBeUndefined();
  expect(mapped.price).toBe("Harga belum diisi");
  expect(parseDetailTab("arbitrary")).toBe("overview");
  expect(parseDetailTab("history")).toBe("history");
});
it("keeps OCR required distinct from ready knowledge", () => {
  const doc = mapListingKnowledge({
    id: "d",
    file_name: "Promo.pdf",
    mime_type: "application/pdf",
    size_bytes: 2048,
    status: "OCR_REQUIRED",
    created_at: "",
    updated_at: "",
  });
  expect(doc.status).toBe("Perlu OCR");
  expect(doc.ready).toBe(false);
  expect(doc.size).toBe("2 KB");
});
