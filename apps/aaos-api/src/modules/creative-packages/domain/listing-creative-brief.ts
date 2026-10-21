import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";
import type { SaveCampaignDraft } from "../dto/campaign-draft.dto.js";

import { validateCreativeBrief, type BriefValidation } from "./structured-creative-brief.js";

/** Fact-grounded baseline using existing listing strategy. Does not claim LLM or market analysis. */
export function buildListingCreativeBrief(
  tenantId: string,
  briefId: string,
  draft: SaveCampaignDraft,
  listing: ListingResponseDto,
): BriefValidation {
  const location = [listing.kecamatan, listing.city, listing.province].filter(Boolean).join(", ");
  const fact = (field: string, value: string) => ({
    text: value,
    sourceId: listing.id,
    sourceLocator: `listing.${field}@${listing.updatedAt}`,
    sourceType: "LISTING" as const,
  });
  const factualClaims = [fact("title", listing.title)];
  if (location) factualClaims.push(fact("location", location));
  if (listing.price > 0)
    factualClaims.push(fact("price", `Harga listing Rp${listing.price.toLocaleString("id-ID")}`));
  if (listing.landArea) factualClaims.push(fact("landArea", `Luas tanah ${listing.landArea} m²`));
  if (listing.buildArea)
    factualClaims.push(fact("buildArea", `Luas bangunan ${listing.buildArea} m²`));
  if (listing.certificate) factualClaims.push(fact("certificate", listing.certificate));
  const whatsapp = draft.goal === "WhatsApp Leads" || draft.goal === "Qualified Leads";
  // Page identity is not a lead-form destination. A form/website must be selected explicitly.
  const CTA = {
    label: whatsapp ? "Hubungi melalui WhatsApp" : "Pelajari Selengkapnya",
    destinationType: whatsapp
      ? "WHATSAPP"
      : draft.goal === "Meta Lead Form"
        ? "LEAD_FORM"
        : "WEBSITE",
    destination: whatsapp ? (draft.metaDestination?.number.replace(/\D/g, "") ?? "") : "",
  };
  return validateCreativeBrief({
    schemaVersion: 1,
    briefId,
    tenantId,
    sourceType: "LISTING",
    listingId: listing.id,
    campaignDraftId: draft.id,
    objective: draft.goal,
    optimizationGoal: whatsapp ? "Percakapan dan kualifikasi peminat listing" : draft.goal,
    targetAudience: {
      segments: ["Peminat properti sesuai lokasi dan harga listing"],
      geo: location
        ? [{ name: location, radiusKm: listing.price >= 3e9 ? 25 : listing.price >= 1e9 ? 15 : 10 }]
        : [],
      buyerIntent: [
        "Mencari informasi properti",
        "Membandingkan spesifikasi dan harga",
        "Merencanakan survei",
      ],
      validationStatus: "DRAFT_NOT_META_VALIDATED",
    },
    personas: ["Calon pembeli yang mengevaluasi kecocokan properti"],
    offer: {
      ...(listing.price > 0 ? { price: listing.price } : {}),
      primaryOffer: listing.title,
      verifiedClaims: [],
    },
    creativeStrategy: {
      primaryAngles: ["Lokasi", "Spesifikasi", "Harga transparan"],
      secondaryAngles: ["Eksplorasi properti", "Jadwal survei"],
      winningPatterns: [],
      fatiguedPatterns: [],
      preserve: ["Identitas properti dan foto sumber", "Harga dan spesifikasi listing"],
      avoid: [
        "Promo atau fasilitas tanpa sumber",
        "Perubahan struktur bangunan",
        "Janji kenaikan nilai investasi",
      ],
      explore: ["Tur properti berbasis foto asli", "Penjelasan spesifikasi", "Ajakan survei"],
    },
    formats: [
      { type: "IMAGE", quantity: 3, aspectRatios: ["4:5", "1:1"] },
      { type: "VIDEO", quantity: 2, aspectRatios: ["9:16"] },
    ],
    tone: "Informatif, jelas, profesional; gunakan Bahasa Indonesia",
    CTA,
    conceptCount: 5,
    brandRules: [
      "Jangan membuat logo atau identitas agen yang tidak disediakan",
      "Pertahankan keaslian properti; tandai visual konseptual",
    ],
    factualClaims,
    knowledgeSourceIds: [],
    simulationPolicy: "OPTIONAL",
    createdBy: "SAMANTHA",
    strategyMethod: "LISTING_RULES",
  });
}
