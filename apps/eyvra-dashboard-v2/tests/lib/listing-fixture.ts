import type { ListingRecord } from "@/lib/listings";
export function listingFixture(id = "one", title = "Rumah contoh"): ListingRecord {
  return {
    listing: {
      id,
      title,
      propertyType: "RUMAH",
      listingStatus: "AKTIF",
      price: 1200000000,
      city: "Bandung",
      landArea: 100,
      buildArea: 80,
      bedrooms: 3,
      bathrooms: 2,
      certificate: "SHM",
      photos: [{ id: "photo", url: "/test-property.svg", isMain: true, order: 0 }],
      highlights: [],
      waNumber: "628123",
      createdAt: "2026-09-22",
      updatedAt: "2026-09-22",
    },
    readiness: {
      ready: true,
      checks: [
        "propertyType",
        "price",
        "location",
        "listingActive",
        "usablePhotos",
        "whatsappDestination",
      ].map((name) => ({ name, passed: true })),
      blockingIssues: [],
      skippedChecks: [],
    },
    copy: {
      id: `${id}:copy`,
      origin: "LISTING_FACTS",
      primaryText: "Rumah contoh di Bandung.",
      headline: title,
      description: "Informasi properti di Bandung.",
      destination: "WHATSAPP",
      factsUpdatedAt: "2026-09-22",
    },
  };
}
