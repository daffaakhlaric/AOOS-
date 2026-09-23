import { assessListingReadiness } from "../../campaign-creation/domain/listing-readiness.js";
import type { ListingResponseDto } from "../dto/listing.dto.js";

/** Deterministic, fact-only draft. This is not an LLM recommendation or approved copy. */
export function buildListingAdvertising(listing: ListingResponseDto) {
  const readiness = assessListingReadiness(listing);
  const location = [listing.kecamatan, listing.city, listing.province].filter(Boolean).join(", ");
  const facts = [
    listing.title,
    location ? "Lokasi: " + location + "." : undefined,
    listing.price > 0
      ? "Harga " +
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(listing.price) +
        "."
      : undefined,
    listing.landArea ? "Luas tanah " + listing.landArea + " m²." : undefined,
    listing.buildArea ? "Luas bangunan " + listing.buildArea + " m²." : undefined,
    listing.certificate ? "Sertifikat: " + listing.certificate + "." : undefined,
  ].filter(Boolean);
  return {
    listing,
    readiness,
    copy: {
      id: listing.id + ":facts:" + listing.updatedAt,
      origin: "LISTING_FACTS" as const,
      primaryText:
        facts.join(" ") + (listing.waNumber ? " Hubungi untuk informasi dan jadwal survei." : ""),
      headline: listing.title,
      description: location
        ? "Informasi properti di " + location + "."
        : "Informasi sesuai data listing.",
      destination: listing.waNumber ? ("WHATSAPP" as const) : undefined,
      factsUpdatedAt: listing.updatedAt,
    },
  };
}
